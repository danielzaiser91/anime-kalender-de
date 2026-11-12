/**
 * Wächter „Werkzeug ohne Test“: Die Zahl der Werkzeuge unter `tools/` ohne Test darf nur sinken (12.11.2026).
 * Werkzeug = Skript `tools/**` (.mjs .cjs .js .mts .ts, ohne Tests, `.d.ts` und `tools/archiv/`).
 * Getestet = der Dateiname steht im Quelltext (ohne Kommentare) einer Testdatei (`*.test.*`, `pipeline/check-*`) oder in einer Zeile von
 * `tools/check-logic-liste.txt` / `tools/check-bestand-liste.txt` (Aufruf in der Kette, nur nach Namen, ohne Kommentarzeilen).
 * Zwei Listen: `tools/werkzeug-ohne-test-bekannt.txt` (Altbestand, `pfad # Grund`) darf gegenüber main nur schrumpfen;
 * `tools/werkzeug-ohne-test-freigabe.txt` (`pfad # Grund`, Grund Pflicht) ist der Weg für ein neues Werkzeug ohne Test.
 * Eintrag, der nicht mehr nötig ist (Datei weg, jetzt getestet), ist selbst ein Fehler: streichen.
 * Basis der Ratsche: im PR-Ereignis der erste Elternteil des Merge-Commits, sonst origin/main; ohne Basis gilt die eigene Datei (Warnung).
 * Aufruf: `node tools/werkzeug-ohne-test-wache.mjs [wurzel]`; läuft über `tools/check-logic-liste.txt` in check:logic.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
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
// `pipeline/check-*` sind die Tests der Kette (check-logic-liste), auch wenn sie nicht `.test.` heißen.
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

/** Fehlertexte; `basis` = Pfade der Altbestandsliste auf main (oder null). Leer = in Ordnung. */
export function pruefe({ dateien, bekanntText, freigabeText, basis }) {
  const fehler = []
  const ist = new Set(ohneTest(dateien))
  const bekannt = eintraege(bekanntText)
  const frei = eintraege(freigabeText)
  for (const [pfad, grund] of [...bekannt, ...frei]) if (!grund) fehler.push(`${pfad}: Eintrag ohne Grund hinter „#“.`)
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

/** Pfade der Altbestandsliste auf main; null, wenn dort nicht lesbar. */
export function basisPfade(cwd, env = process.env) {
  try {
    const sha = env.GITHUB_EVENT_NAME === 'pull_request' ? ladeBasis((...a) => git(a, cwd)) : 'origin/main'
    return new Set(eintraege(git(['show', `${sha}:${BEKANNT}`], cwd)).keys())
  } catch {
    return null
  }
}

/** Liest alle versionierten Dateien unter `wurzel`, prüft und liefert Fehler, Zahl und Basis. */
export function pruefeWurzel(wurzel, env = process.env) {
  const ls = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard'], wurzel)
  const dateien = new Map()
  for (const pfad of ls.split('\0').filter((p) => /^(tools|pipeline|web|worker|extension|shared)\/.*\.(mjs|cjs|js|mts|ts|tsx|txt)$/.test(p))) {
    // Im Index, aber gelöscht (ungestagte Löschung): wie eine fehlende Datei behandeln.
    if (existsSync(join(wurzel, pfad))) dateien.set(pfad, readFileSync(join(wurzel, pfad), 'utf8'))
  }
  const lies = (p) => (dateien.has(p) ? dateien.get(p) : readFileSync(join(wurzel, p), 'utf8'))
  const basis = basisPfade(wurzel, env)
  const fehler = pruefe({ dateien, bekanntText: lies(BEKANNT), freigabeText: lies(FREIGABE), basis })
  return { fehler, basis, ohneTest: ohneTest(dateien).length, werkzeuge: [...dateien.keys()].filter(istWerkzeug).length }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const wurzel = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..')
  const { fehler, basis, ohneTest: n, werkzeuge } = pruefeWurzel(wurzel)
  for (const f of fehler) console.error(`check:logic: ${f}`)
  if (!basis) console.log('⚠ WARNUNG Ratsche-Basis: eigene Datei (Basis nicht erreichbar, die Liste im PR gilt als Erlaubnis)')
  if (fehler.length) process.exit(1)
  if (werkzeuge === 0) {
    console.error('check:logic: 0 Werkzeuge gefunden, der Wächter wäre blind.')
    process.exit(1)
  }
  console.log(`werkzeug-ohne-test-wache: ${n} von ${werkzeuge} Werkzeugen unter tools/ ohne Test, alle auf der Liste (nur sinkend gegen main).`)
}
