/**
 * Wächter „Prüfskript ohne Aufrufer“: Ein Prüfskript, das nichts aufruft, prüft nichts (Bauer 1659, 20.10.2026).
 * Prüfskript = Datei `tools/*.mjs|cjs` oder `pipeline/*.ts` (ohne Tests, ohne Unterordner), deren Name nach Prüfung klingt
 * (check, pruef, wache, sperre, guard, valid, lint, gate) und die ein Programm ist: mit Startform (`process.argv[1]`,
 * `require.main`) oder ohne `export`. Reine Bibliotheken (mit `export`, ohne Startform) zählen nicht.
 * Aufrufer = jede andere versionierte Datei außerhalb von data/, public/, docs/, die den Pfad oder den Dateinamen
 * als eigenes Wort nennt (package.json, Workflows, Listen, andere Skripte). Tests (`*.test.*`) zählen nicht:
 * Sie belegen das Skript, hängen es aber nicht in die Kette.
 * Ausnahmen: `tools/skript-aufrufer-ausnahmen.txt`, eine Datei je Zeile `pfad # Grund` (Grund Pflicht);
 * eine Ausnahme, die nicht mehr nötig ist (Datei weg, kein Prüfskript, hat Aufrufer), ist selbst ein Fehler.
 * Aufruf: `node tools/skript-aufrufer-wache.mjs`; läuft über `tools/check-logic-liste.txt` in check:logic.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SKRIPT = /^(tools\/[^/]+\.(mjs|cjs)|pipeline\/[^/]+\.ts)$/
const PRUEF_NAME = /check|pruef|wache|sperre|guard|valid|lint|gate/i
const STARTFORM = /process\.argv\[1\]|require\.main/
const EXPORT = /^\s*export\s/m
const AUSNAHMEN = 'tools/skript-aufrufer-ausnahmen.txt'
const KEIN_AUFRUFER = /^(data|public|docs)\//
const LESBAR = /\.(mjs|cjs|ts|tsx|sh|json|ya?ml|txt)$/

const maskiere = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const istTest = (pfad) => /\.test\./.test(pfad)

/** Ist die Datei ein Prüfskript (Name und Programm, keine Bibliothek)? */
export function istPruefskript(pfad, text) {
  if (!SKRIPT.test(pfad) || istTest(pfad) || pfad.endsWith('.d.ts')) return false
  if (!PRUEF_NAME.test(pfad.split('/').pop())) return false
  return STARTFORM.test(text) || !EXPORT.test(text)
}

/** Nennt `text` das Skript als eigenes Wort (Pfad oder Dateiname, nicht Teil eines längeren Namens)? */
export function nenntSkript(text, pfad) {
  const name = pfad.split('/').pop()
  const ohneEndung = name.replace(/\.(mjs|cjs|ts)$/, '')
  const endungsfrei = pfad.endsWith('.ts') ? `|${maskiere(ohneEndung)}(?=['"])` : ''
  return new RegExp(`(?<![\\w.-])(?:${maskiere(name)}${endungsfrei})(?![\\w.-])`).test(text)
}

const zeilen = (text) => text.split(/\r?\n/).filter((z) => z.replace(/#.*/, '').trim())
const grund = (zeile) => zeile.split('#').slice(1).join('#').trim()

/**
 * Eingabe: `dateien` (Map Pfad → Text aller versionierten, lesbaren Dateien), `ausnahmenText` (Inhalt der Ausnahmeliste).
 * Ausgabe: Fehlertexte, leer = in Ordnung.
 */
export function ohneAufrufer({ dateien, ausnahmenText }) {
  const fehler = []
  const pruefskripte = [...dateien].filter(([pfad, text]) => istPruefskript(pfad, text)).map(([pfad]) => pfad)
  const hatAufrufer = (pfad) => [...dateien].some(([q, text]) => q !== pfad && q !== AUSNAHMEN && !istTest(q) && !KEIN_AUFRUFER.test(q) && nenntSkript(text, pfad))
  const ausnahmen = new Map()
  for (const z of zeilen(ausnahmenText)) {
    const pfad = z.replace(/#.*/, '').trim()
    if (!grund(z)) fehler.push(`Ausnahme ${pfad}: ohne Grund hinter „#“, jede Ausnahme braucht einen Halbsatz Grund.`)
    ausnahmen.set(pfad, true)
  }
  for (const pfad of pruefskripte) {
    if (!ausnahmen.has(pfad) && !hatAufrufer(pfad)) {
      fehler.push(`${pfad} hat keinen Aufrufer: in tools/check-logic-liste.txt, package.json oder einen Workflow einhängen, sonst mit Grund in tools/skript-aufrufer-ausnahmen.txt.`)
    }
  }
  for (const pfad of ausnahmen.keys()) {
    if (!pruefskripte.includes(pfad)) fehler.push(`Ausnahme ${pfad}: Datei gibt es nicht (mehr) oder sie ist kein Prüfskript: streichen.`)
    else if (hatAufrufer(pfad)) fehler.push(`Ausnahme ${pfad}: hat inzwischen einen Aufrufer: streichen.`)
  }
  return fehler
}

/** Liest alle versionierten Dateien unter `wurzel` und die Ausnahmeliste. */
export function pruefeAufrufer(wurzel) {
  const ls = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: wurzel, encoding: 'utf8', maxBuffer: 1 << 28, windowsHide: true })
  const dateien = new Map()
  for (const pfad of ls.split('\0').filter((p) => LESBAR.test(p) && !/package-lock/.test(p) && !/^(data|public)\//.test(p))) {
    dateien.set(pfad, readFileSync(join(wurzel, pfad), 'utf8'))
  }
  const ausnahmenText = dateien.get(AUSNAHMEN) ?? ''
  return { fehler: ohneAufrufer({ dateien, ausnahmenText }), geprueft: [...dateien].filter(([p, t]) => istPruefskript(p, t)).length }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { fehler, geprueft } = pruefeAufrufer(join(dirname(fileURLToPath(import.meta.url)), '..'))
  for (const f of fehler) console.error(`check:logic: ${f}`)
  if (fehler.length) process.exit(1)
  console.log(`skript-aufrufer-wache: ${geprueft} Prüfskripte, alle haben einen Aufrufer oder eine begründete Ausnahme.`)
}
