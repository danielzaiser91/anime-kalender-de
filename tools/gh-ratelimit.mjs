/**
 * Gemeinsamer Umgang mit dem API-Kontingent des GITHUB_TOKEN für die Prüfer-Läufe (nur Node-Bordmittel, Workflows ohne `npm ci`).
 *
 *   node tools/gh-ratelimit.mjs rest                 (druckt `x-ratelimit-remaining: <n>`, Exit immer 0)
 *   node tools/gh-ratelimit.mjs warten <stderr-datei> (Exit 0 nach Warten bis zum Reset, wenn der Text „rate limit“ nennt; sonst Exit 1)
 *
 * Ein Stundenlimit überbrückt keine kurze Wiederholung: bei „rate limit“ wartet der Aufrufer bis zum Reset, höchstens MAX_WARTE_MS.
 * `gh api rate_limit` zählt selbst nicht gegen das Limit.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

export const MAX_WARTE_MS = 15 * 60_000
const PUFFER_MS = 2000
// Ohne lesbaren Reset kurz warten statt bis zum Deckel: der Aufrufer versucht es danach genau einmal neu.
const OHNE_RESET_MS = 60_000

export const istRateLimit = (text) => /rate limit/i.test(String(text ?? ''))

/** Wartezeit bis zum Reset (Sekunden seit 1970) plus Puffer, nie über dem Deckel und nie negativ. */
export function wartezeitMs(resetSek, jetztMs, max = MAX_WARTE_MS) {
  if (!Number.isFinite(resetSek) || resetSek <= 0) return Math.min(OHNE_RESET_MS, max)
  return Math.min(Math.max(resetSek * 1000 - jetztMs + PUFFER_MS, 0), max)
}

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
  return { remaining: core.remaining, reset: core.reset }
}

/** Reset-Zeitpunkt oder NaN; ein nicht lesbarer Reset ergibt die kurze Ersatzwartezeit aus wartezeitMs. */
function leseReset(gh) {
  try {
    return holeKontingent(gh).reset
  } catch {
    return NaN
  }
}

/** Ruft `gh(args)`; bei „rate limit“ im Fehler einmal bis zum Reset warten und neu versuchen, jeder andere Fehler wirft sofort. */
export function ghMitLimit(gh, args, { warte = warteSync, jetzt = Date.now, max = MAX_WARTE_MS } = {}) {
  try {
    return gh(args)
  } catch (e) {
    if (!istRateLimit(e.message)) throw e
    warte(wartezeitMs(leseReset(gh), jetzt(), max))
    return gh(args)
  }
}

export function restZeile(gh) {
  try {
    return `x-ratelimit-remaining: ${holeKontingent(gh).remaining}`
  } catch (e) {
    return `x-ratelimit-remaining: unbekannt (${String(e.message).split('\n')[0]})`
  }
}

/** CLI-Kern, Rückgabe ist der Exit-Code. */
export function cli([befehl, datei], { gh = ghRoh, warte = warteSync, jetzt = Date.now, log = console.log } = {}) {
  if (befehl === 'rest') return log(restZeile(gh)), 0
  if (befehl !== 'warten' || !datei) return log('Aufruf: gh-ratelimit.mjs rest | warten <stderr-datei>'), 2
  let text = ''
  try {
    text = fs.readFileSync(datei, 'utf8')
  } catch {
    return 1
  }
  if (!istRateLimit(text)) return 1
  const ms = wartezeitMs(leseReset(gh), jetzt())
  log(`API-Kontingent erschöpft: warte ${Math.round(ms / 1000)} s bis zum Reset`)
  warte(ms)
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(cli(process.argv.slice(2)))
