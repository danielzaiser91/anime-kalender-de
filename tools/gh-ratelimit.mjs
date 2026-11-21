/**
 * Gemeinsamer Umgang mit dem API-Kontingent des GITHUB_TOKEN für die Prüfer-Läufe (nur Node-Bordmittel, Workflows ohne `npm ci`).
 *
 *   node tools/gh-ratelimit.mjs rest                 (druckt `x-ratelimit-remaining: <n>`, Exit immer 0)
 *   node tools/gh-ratelimit.mjs warten <stderr-datei> (Exit 0 nach Warten bis zum Reset, wenn der Text „rate limit“ nennt;
 *                                                      Exit 1: kein „rate limit“ im Text; Exit 2: Aufruf falsch;
 *                                                      Exit 3: Reset liegt jenseits des Zeitkontos, nicht gewartet)
 *
 * Ein Stundenlimit überbrückt keine kurze Wiederholung: bei „rate limit“ wartet der Aufrufer bis zum Reset, aber nur, solange das
 * Zeitkonto des Jobs es deckt (KONTO_MS für ALLE Warteplätze zusammen: Shell-Schritte, Node-Werkzeuge, mehrere Prozesse). Deckt es
 * die nötige Wartezeit nicht mehr, wird nicht gewartet (der Neuversuch scheiterte sicher): der Fehler kommt sichtbar durch.
 * Das Konto liegt in einer Datei (GH_LIMIT_KONTO, sonst $RUNNER_TEMP/gh-limit-konto); ohne beides zählt es im Speicher des Prozesses.
 * Shell-Gegenstück zu ghMitLimit: tools/gh-mit-limit.sh. `gh api rate_limit` zählt selbst nicht gegen das Limit.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/** Summe aller Wartezeiten eines Jobs bei „rate limit“; die Job-Timeouts im Workflow werden daraus abgeleitet. */
export const KONTO_MS = 15 * 60_000
const PUFFER_MS = 2000
// Ohne lesbaren Reset kurz warten: der Aufrufer versucht es danach genau einmal neu.
const OHNE_RESET_MS = 60_000

export const istRateLimit = (text) => /rate limit/i.test(String(text ?? ''))

/** Wartezeit bis zum Reset (Sekunden seit 1970) plus Puffer, nie negativ; ohne lesbaren Reset die kurze Ersatzwartezeit. */
export function wartezeitMs(resetSek, jetztMs) {
  if (!Number.isFinite(resetSek) || resetSek <= 0) return OHNE_RESET_MS
  return Math.max(resetSek * 1000 - jetztMs + PUFFER_MS, 0)
}

const kontoDatei = () => process.env.GH_LIMIT_KONTO || (process.env.RUNNER_TEMP ? path.join(process.env.RUNNER_TEMP, 'gh-limit-konto') : '')

/** Zeitkonto: `rest()` = noch erlaubte ms, `buche(ms)` verbraucht sie. Eine unlesbare Datei gilt als verbraucht (kein Warten), eine fehlende als leer. */
export function neuesKonto({ datei = kontoDatei(), grenze = KONTO_MS } = {}) {
  let speicher = 0
  const gebucht = () => {
    if (!datei) return speicher
    if (!fs.existsSync(datei)) return 0
    const n = Number(fs.readFileSync(datei, 'utf8'))
    return Number.isFinite(n) && n >= 0 ? n : grenze
  }
  return {
    rest: () => Math.max(grenze - gebucht(), 0),
    buche(ms) {
      const neu = gebucht() + ms
      if (datei) fs.writeFileSync(datei, String(neu))
      else speicher = neu
    },
  }
}

let prozessKonto = null
/** Das Konto dieses Prozesses (und mit Datei: des ganzen Jobs). */
const standardKonto = () => (prozessKonto ??= neuesKonto())

/** `gh` als Funktion: Argumente rein, stdout raus; scheitert der Aufruf, steht die erste stderr-Zeile im Fehler. */
export function ghRoh(args) {
  const r = spawnSync('gh', args, { encoding: 'utf8', windowsHide: true, maxBuffer: 1 << 24, timeout: 60_000 })
  if (r.error) throw r.error
  if (r.status !== 0) {
    const grund = String(r.stderr ?? '').trim().split('\n')[0]
    throw new Error(`gh ${args.slice(0, 3).join(' ')} Exit ${r.status}${grund ? `: ${grund}` : ''}`)
  }
  return r.stdout
}

export const warteSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

/** Kern-Kontingent {remaining, reset} aus `gh api rate_limit`. */
export function holeKontingent(gh) {
  const core = JSON.parse(gh(['api', 'rate_limit'])).resources?.core ?? {}
  return { remaining: core.remaining, reset: core.reset, limit: core.limit, used: core.used }
}

/** Reset-Zeitpunkt oder NaN; ein nicht lesbarer Reset ergibt die kurze Ersatzwartezeit aus wartezeitMs. */
function leseReset(gh) {
  try {
    return holeKontingent(gh).reset
  } catch {
    return NaN
  }
}

/** Wartezeit bis zum Reset und ob das Zeitkonto sie deckt (`ok`); nur bei `ok` darf der Aufrufer warten. */
export function plane(gh, konto, jetzt) {
  const ms = wartezeitMs(leseReset(gh), jetzt())
  const rest = konto.rest()
  return { ms, rest, ok: ms <= rest }
}

const sekunden = (ms) => Math.round(ms / 1000)
export const keinWartenText = (p) => `Reset in ${sekunden(p.ms)} s, Zeitkonto hat noch ${sekunden(p.rest)} s: nicht gewartet`

/** Ruft `gh(args)`; bei „rate limit“ im Fehler einmal bis zum Reset warten (wenn das Zeitkonto es deckt) und neu versuchen, jeder andere Fehler wirft sofort. */
export function ghMitLimit(gh, args, { warte = warteSync, jetzt = Date.now, konto = standardKonto() } = {}) {
  try {
    return gh(args)
  } catch (e) {
    if (!istRateLimit(e.message)) throw e
    const p = plane(gh, konto, jetzt)
    if (!p.ok) throw new Error(`${e.message} (${keinWartenText(p)})`)
    konto.buche(p.ms)
    warte(p.ms)
    return gh(args)
  }
}

/** `gh api <args>` als JSON, mit dem Schutz von ghMitLimit (für pr-nachtraege und pr-pruefer-modus). */
export const ghApiJsonMitLimit = (args) => JSON.parse(ghMitLimit(ghRoh, ['api', ...args]))

function ghLauf(args) {
  return spawnSync('gh', args, { encoding: 'utf8', windowsHide: true, maxBuffer: 1 << 28, timeout: 120_000 })
}

/** Wie ghMitLimit für einen Aufruf, dessen Ergebnis {status, stdout, stderr} ist (große Ausgabe, z. B. `gh pr diff`). */
export function laufMitLimit(args, { lauf = ghLauf, gh = ghRoh, warte = warteSync, jetzt = Date.now, konto = standardKonto() } = {}) {
  const r = lauf(args)
  if (r.status === 0 || !istRateLimit(r.stderr)) return r
  const p = plane(gh, konto, jetzt)
  if (!p.ok) return { ...r, stderr: `${r.stderr}\n(${keinWartenText(p)})` }
  konto.buche(p.ms)
  warte(p.ms)
  return lauf(args)
}

/** Logzeile mit Rest, Limit, Verbrauch und Reset (UTC); fehlen Limit und Reset in der Antwort, steht nur der Rest da. */
export function restZeile(gh) {
  try {
    const { remaining, limit, used, reset } = holeKontingent(gh)
    if (!Number.isFinite(limit) || !Number.isFinite(reset) || reset <= 0) return `x-ratelimit-remaining: ${remaining}`
    return `x-ratelimit-remaining: ${remaining} (limit ${limit}, used ${used}, reset ${new Date(reset * 1000).toISOString().slice(11, 19)} UTC)`
  } catch (e) {
    return `x-ratelimit-remaining: unbekannt (${String(e.message).split('\n')[0]})`
  }
}

/** CLI-Kern, Rückgabe ist der Exit-Code (0 gewartet, 1 kein „rate limit“, 2 Aufruf falsch, 3 Zeitkonto reicht nicht). */
export function cli([befehl, datei], { gh = ghRoh, warte = warteSync, jetzt = Date.now, log = console.log, konto = standardKonto() } = {}) {
  if (befehl === 'rest') return log(restZeile(gh)), 0
  if (befehl !== 'warten' || !datei) return log('Aufruf: gh-ratelimit.mjs rest | warten <stderr-datei>'), 2
  let text = ''
  try {
    text = fs.readFileSync(datei, 'utf8')
  } catch {
    return 1
  }
  if (!istRateLimit(text)) return 1
  const p = plane(gh, konto, jetzt)
  if (!p.ok) return log(`API-Kontingent erschöpft: ${keinWartenText(p)}`), 3
  log(`API-Kontingent erschöpft: warte ${sekunden(p.ms)} s bis zum Reset`)
  konto.buche(p.ms)
  warte(p.ms)
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(cli(process.argv.slice(2)))
