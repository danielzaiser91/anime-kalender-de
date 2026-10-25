/**
 * Wächter „Prüfskript ohne Aufrufer“: Ein Prüfskript, das nichts aufruft, prüft nichts (Bauer 1659, 20.10.2026).
 * Prüfskript = Datei `tools/**` oder `pipeline/**` (.mjs .cjs .js .mts .ts, ohne Tests), deren Name nach Prüfung klingt
 * (check, pruef, wache, waechter, sperre, guard, valid, verify, audit, lint, gate) und die ein Programm ist:
 * Startform (`process.argv[1]`, `require.main`) oder Top-Level-Lauf (`process.exit(`, `main(`) oder kein `export`.
 * Reine Bibliotheken (mit `export`, ohne Startform und Lauf) zählen nicht. Kommentare werden vor jeder Erkennung entfernt.
 * Aufrufer zählen nur aus dem Kern: `scripts` jeder package.json, `run`-Zeilen der Workflows und Actions, die Listen
 * `tools/check-logic-liste.txt` und `tools/check-bestand-liste.txt` (ohne Kommentarzeilen). Von dort gilt die Kette
 * transitiv: Ein Skript zählt nur als Aufrufer, wenn es selbst erreicht ist (Waisen, Tests, docs rufen nichts auf).
 * Ausnahmen: `tools/skript-aufrufer-ausnahmen.txt`, eine Datei je Zeile `pfad # Grund` (Grund Pflicht);
 * eine Ausnahme, die nicht mehr nötig ist (Datei weg, kein Prüfskript, erreicht), ist selbst ein Fehler.
 * Aufruf: `node tools/skript-aufrufer-wache.mjs [wurzel]`; läuft über `tools/check-logic-liste.txt` in check:logic.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

const SKRIPT = /^(tools|pipeline)\/(?:.+\/)?[^/]+\.(mjs|cjs|js|mts|ts)$/
const PRUEF_NAME = /check|pruef|wache|waechter|sperre|guard|valid|verify|audit|lint|gate/i
const STARTFORM = /process\.argv\[1\]|require\.main/
const TOPLEVEL_LAUF = /^(?!export |function |async function )[^\n]*\bprocess\.exit(?:Code)?\b|^(?:void |await )?main\(/m
const EXPORT = /^\s*export\s/m
const LESBAR = /\.(mjs|cjs|js|mts|ts|tsx|sh|json|ya?ml|txt)$/
const LISTEN = ['tools/check-logic-liste.txt', 'tools/check-bestand-liste.txt']
const AUSNAHMEN = 'tools/skript-aufrufer-ausnahmen.txt'

const maskiere = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const istTest = (pfad) => /\.test\./.test(pfad)
const zeilen = (text) => text.split(/\r?\n/).filter((z) => z.replace(/#.*/, '').trim())
const grund = (zeile) => zeile.split('#').slice(1).join('#').trim()

/** Text ohne Kommentare: Block- und Zeilenkommentare in Code, `#`-Zeilen in Shell. */
export function ohneKommentar(pfad, text) {
  if (pfad.endsWith('.sh')) return text.replace(/^\s*#.*$/gm, '')
  if (!/\.(mjs|cjs|js|mts|ts|tsx)$/.test(pfad)) return text
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\w'"`\\])\/\/.*$/gm, '$1')
}

/** Ist die Datei ein Prüfskript (Name und Programm, keine Bibliothek)? */
export function istPruefskript(pfad, text) {
  if (!SKRIPT.test(pfad) || istTest(pfad) || pfad.endsWith('.d.ts')) return false
  if (!PRUEF_NAME.test(pfad.split('/').pop())) return false
  const code = ohneKommentar(pfad, text)
  return STARTFORM.test(code) || TOPLEVEL_LAUF.test(code) || !EXPORT.test(code)
}

/** Nennt `text` das Skript als eigenes Wort (Dateiname) oder, bei TypeScript, als Importpfad ohne Endung nach einem „/“? */
export function nenntSkript(text, pfad) {
  const name = pfad.split('/').pop()
  const basis = name.replace(/\.(mjs|cjs|js|mts|ts)$/, '')
  const import_ = /\.m?ts$/.test(pfad) ? `|(?<=\\/)${maskiere(basis)}(?:\\.js)?(?=['"])` : ''
  return new RegExp(`(?<![\\w.-])(?:${maskiere(name)}${import_})(?![\\w.-])`).test(text)
}

/** Alle `run`-Werte eines YAML-Dokuments (Workflows, Actions). */
function laeufe(wert) {
  if (Array.isArray(wert)) return wert.flatMap(laeufe)
  if (!wert || typeof wert !== 'object') return []
  return Object.entries(wert).flatMap(([k, v]) => (k === 'run' && typeof v === 'string' ? [v] : laeufe(v)))
}

const versuche = (f) => {
  try {
    return f()
  } catch {
    return []
  }
}

/** Texte, die zählen, ohne dass ein Skript sie aufruft: package.json-scripts, run-Zeilen, Listenzeilen. */
export function kernTexte(dateien) {
  const texte = []
  for (const [pfad, text] of dateien) {
    if (/(^|\/)package\.json$/.test(pfad)) texte.push(...versuche(() => Object.values(JSON.parse(text).scripts ?? {})))
    else if (/^\.github\/(workflows|actions)\/.*\.ya?ml$/.test(pfad)) texte.push(...versuche(() => laeufe(parse(text))))
    else if (LISTEN.includes(pfad)) texte.push(...zeilen(text).map((z) => z.replace(/#.*/, '')))
  }
  return texte
}

/** Menge der Skripte, die vom Kern aus (transitiv) aufgerufen werden. */
export function erreichbar(dateien) {
  const skripte = [...dateien.keys()].filter((p) => (SKRIPT.test(p) || /\.sh$/.test(p)) && !istTest(p))
  const erreicht = new Set()
  const offen = [...kernTexte(dateien)]
  while (offen.length) {
    const text = offen.pop()
    for (const pfad of skripte) {
      if (erreicht.has(pfad) || !nenntSkript(text, pfad)) continue
      erreicht.add(pfad)
      offen.push(ohneKommentar(pfad, dateien.get(pfad)))
    }
  }
  return erreicht
}

/**
 * Eingabe: `dateien` (Map Pfad → Text aller versionierten, lesbaren Dateien), `ausnahmenText` (Inhalt der Ausnahmeliste).
 * Ausgabe: Fehlertexte, leer = in Ordnung.
 */
export function ohneAufrufer({ dateien, ausnahmenText }) {
  const fehler = []
  const pruefskripte = [...dateien].filter(([pfad, text]) => istPruefskript(pfad, text)).map(([pfad]) => pfad)
  const erreicht = erreichbar(dateien)
  const ausnahmen = new Set()
  for (const z of zeilen(ausnahmenText)) {
    const pfad = z.replace(/#.*/, '').trim()
    if (!grund(z)) fehler.push(`Ausnahme ${pfad}: ohne Grund hinter „#“, jede Ausnahme braucht einen Halbsatz Grund.`)
    ausnahmen.add(pfad)
  }
  for (const pfad of pruefskripte) {
    if (!ausnahmen.has(pfad) && !erreicht.has(pfad)) {
      fehler.push(`${pfad} hat keinen Aufrufer: in tools/check-logic-liste.txt, package.json oder einen Workflow einhängen, sonst mit Grund in tools/skript-aufrufer-ausnahmen.txt.`)
    }
  }
  for (const pfad of ausnahmen) {
    if (!pruefskripte.includes(pfad)) fehler.push(`Ausnahme ${pfad}: Datei gibt es nicht (mehr) oder sie ist kein Prüfskript: streichen.`)
    else if (erreicht.has(pfad)) fehler.push(`Ausnahme ${pfad}: hat inzwischen einen Aufrufer: streichen.`)
  }
  return fehler
}

/** Liest alle versionierten Dateien unter `wurzel` und die Ausnahmeliste. */
export function pruefeAufrufer(wurzel) {
  const ls = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: wurzel, encoding: 'utf8', maxBuffer: 1 << 28, windowsHide: true })
  const dateien = new Map()
  for (const pfad of ls.split('\0').filter((p) => LESBAR.test(p) && !/package-lock/.test(p) && !/^(data|public|docs)\//.test(p))) {
    dateien.set(pfad, readFileSync(join(wurzel, pfad), 'utf8'))
  }
  const ausnahmenText = dateien.get(AUSNAHMEN) ?? ''
  return { fehler: ohneAufrufer({ dateien, ausnahmenText }), geprueft: [...dateien].filter(([p, t]) => istPruefskript(p, t)).length }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const wurzel = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..')
  const { fehler, geprueft } = pruefeAufrufer(wurzel)
  for (const f of fehler) console.error(`check:logic: ${f}`)
  if (fehler.length) process.exit(1)
  console.log(`skript-aufrufer-wache: ${geprueft} Prüfskripte, alle haben einen Aufrufer oder eine begründete Ausnahme.`)
}
