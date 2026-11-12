/**
 * Wächter „Werkzeug ohne Test“ (12.11.2026): Die Altbestandsliste ohne Test darf gegenüber main nur schrumpfen; ein neues Werkzeug braucht einen Test oder eine Freigabe mit Grund (≥ 3 Wörter, neue Freigabe = ⚠ WARNUNG).
 * Bewusste Grenze: „Test“ heißt, der Dateiname steht im Code einer `*.test.*`/`pipeline/check-*`-Datei oder in einer Kettenliste (auch als String); ob er wirklich prüft, sieht nur der Prüfer.
 * Basis: im PR-Ereignis `HEAD^1` (Fehler dabei sind rot), sonst origin/main; fehlt die Liste dort, gilt die eigene Datei (Warnung). Aufruf: `node tools/werkzeug-ohne-test-wache.mjs [wurzel]`, in check:logic.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ladeBasis } from './pr-basis.mjs'
import { nenntSkript, ohneKommentar } from './skript-aufrufer-wache.mjs'

export const BEKANNT = 'tools/werkzeug-ohne-test-bekannt.txt'
export const FREIGABE = 'tools/werkzeug-ohne-test-freigabe.txt'
const LISTEN = ['tools/check-logic-liste.txt', 'tools/check-bestand-liste.txt']
const WERKZEUG = /^tools\/(?!archiv\/)(?:.+\/)?[^/]+\.(mjs|cjs|js|mts|ts)$/
const FRIST_MS = 60000

const istTest = (pfad) => /\.test\./.test(pfad)
export const istTestdatei = (pfad) => istTest(pfad) || /^pipeline\/check-[^/]+\.(ts|mjs)$/.test(pfad)
export const istWerkzeug = (pfad) => WERKZEUG.test(pfad) && !istTest(pfad) && !pfad.endsWith('.d.ts')

/** Einträge einer Liste `pfad # Grund` (Kommentar- und Leerzeilen entfallen): Map Pfad → Grund. */
export function eintraege(text) {
  const karte = new Map()
  for (const z of text.split(/\r?\n/)) {
    if (!z.trim() || z.trim().startsWith('#')) continue
    const [pfad, ...rest] = z.split('#')
    karte.set(pfad.trim(), rest.join('#').trim())
  }
  return karte
}

/** Texte, in denen der Name eines Werkzeugs als Test zählt: Testdateien (ohne Kommentare) und Listenzeilen. */
export function testTexte(dateien) {
  const texte = []
  for (const [pfad, text] of dateien) {
    if (istTestdatei(pfad)) texte.push(ohneKommentar(pfad, text))
    else if (LISTEN.includes(pfad)) texte.push(...text.split(/\r?\n/).map((z) => z.replace(/#.*/, '')))
  }
  return texte
}

/** Werkzeuge ohne Test, sortiert. */
export function ohneTest(dateien) {
  const texte = testTexte(dateien)
  return [...dateien.keys()].filter((p) => istWerkzeug(p) && !texte.some((t) => nenntSkript(t, p))).sort()
}

const MIN_WOERTER = 3
const woerter = (grund) => grund.split(/\s+/).filter(Boolean).length

/** Freigabe-Einträge, die auf main (`basisFrei`) noch fehlen; ohne Basis keine Aussage. */
export const neueFreigaben = (frei, basisFrei) => (basisFrei ? [...frei.keys()].filter((p) => !basisFrei.has(p)) : [])

/** Fehlertexte; `basis` = Pfade der Altbestandsliste auf main (oder null). Leer = in Ordnung. */
export function pruefe({ dateien, bekanntText, freigabeText, basis }) {
  const fehler = []
  const ist = new Set(ohneTest(dateien))
  const bekannt = eintraege(bekanntText)
  const frei = eintraege(freigabeText)
  for (const [pfad, grund] of [...bekannt, ...frei]) if (!grund) fehler.push(`${pfad}: Eintrag ohne Grund hinter „#“.`)
  for (const [pfad, grund] of frei) {
    if (grund && woerter(grund) < MIN_WOERTER) fehler.push(`${FREIGABE}: ${pfad}: Grund „${grund}“ hat weniger als ${MIN_WOERTER} Wörter.`)
  }
  for (const pfad of ist) {
    if (!bekannt.has(pfad) && !frei.has(pfad)) fehler.push(`${pfad} hat keinen Test: Test schreiben (Dateiname im Quelltext einer *.test.*-Datei) oder mit Grund in ${FREIGABE} eintragen.`)
  }
  for (const [liste, karte] of [[BEKANNT, bekannt], [FREIGABE, frei]]) {
    for (const pfad of karte.keys()) if (!ist.has(pfad)) fehler.push(`${liste}: ${pfad} ist nicht mehr nötig (Datei weg oder getestet): streichen.`)
  }
  for (const pfad of bekannt.keys()) {
    if (basis && !basis.has(pfad)) fehler.push(`${BEKANNT}: ${pfad} ist neu auf der Altbestandsliste, sie darf nur schrumpfen: Test schreiben oder in ${FREIGABE} eintragen.`)
  }
  return fehler
}

const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 28, timeout: FRIST_MS, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] })

/** Inhalt von `pfad` auf `sha`; null, wenn die Datei dort fehlt (nur das ist „keine Basis“, jeder andere Fehler wirft). */
function leseAufBasis(sha, pfad, cwd) {
  try {
    git(['cat-file', '-e', `${sha}:${pfad}`], cwd)
  } catch {
    return null
  }
  return git(['show', `${sha}:${pfad}`], cwd)
}

/** Basis im PR-Ereignis `HEAD^1` (Fehler wirft), sonst origin/main (nicht vorhanden = null). */
function basisSha(cwd, env) {
  if (env.GITHUB_EVENT_NAME === 'pull_request') return ladeBasis((...a) => git(a, cwd))
  try {
    return git(['rev-parse', '--verify', '-q', 'origin/main'], cwd).trim()
  } catch {
    return null
  }
}

/** Listen auf main: `{ bekannt, frei }` (Pfadmengen); null, wenn die Altbestandsliste dort fehlt. */
export function basisListen(cwd, env = process.env) {
  const sha = basisSha(cwd, env)
  const bekannt = sha ? leseAufBasis(sha, BEKANNT, cwd) : null
  if (!bekannt) return null
  const frei = leseAufBasis(sha, FREIGABE, cwd)
  return { bekannt: new Set(eintraege(bekannt).keys()), frei: new Set(eintraege(frei ?? '').keys()) }
}

/** Liest alle versionierten Dateien unter `wurzel`, prüft und liefert Fehler, Warnungen, Zahl und Basis. */
export function pruefeWurzel(wurzel, env = process.env) {
  const ls = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard'], wurzel)
  const dateien = new Map()
  for (const pfad of ls.split('\0').filter((p) => /^(tools|pipeline|web|worker|extension|shared)\/.*\.(mjs|cjs|js|mts|ts|tsx|txt)$/.test(p))) {
    dateien.set(pfad, readFileSync(join(wurzel, pfad), 'utf8'))
  }
  const basis = basisListen(wurzel, env)
  const bekanntText = dateien.get(BEKANNT)
  const freigabeText = dateien.get(FREIGABE)
  const fehler = pruefe({ dateien, bekanntText, freigabeText, basis: basis?.bekannt ?? null })
  const warnungen = neueFreigaben(eintraege(freigabeText), basis?.frei ?? null).map((p) => `⚠ WARNUNG Neue Freigabe: ${p} (Werkzeug ohne Test, Grund in ${FREIGABE})`)
  return { fehler, warnungen, basis, ohneTest: ohneTest(dateien).length, werkzeuge: [...dateien.keys()].filter(istWerkzeug).length }
}

function main(wurzel) {
  let ergebnis
  try {
    ergebnis = pruefeWurzel(wurzel)
  } catch (e) {
    console.error(`check:logic: Basis oder Dateien nicht lesbar (${e.message.split('\n')[0]}): kein Urteil möglich.`)
    return 1
  }
  const { fehler, warnungen, basis, ohneTest: n, werkzeuge } = ergebnis
  for (const f of fehler) console.error(`check:logic: ${f}`)
  for (const w of warnungen) console.log(w)
  if (!basis) console.log('⚠ WARNUNG Ratsche-Basis: eigene Datei (Altbestandsliste fehlt auf main, die Liste im PR gilt als Erlaubnis)')
  if (fehler.length) return 1
  if (werkzeuge === 0) {
    console.error('check:logic: 0 Werkzeuge gefunden, der Wächter wäre blind.')
    return 1
  }
  console.log(`werkzeug-ohne-test-wache: ${n} von ${werkzeuge} Werkzeugen unter tools/ ohne Test, alle auf der Liste (nur sinkend gegen main).`)
  return 0
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..')))
}
