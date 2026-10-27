#!/usr/bin/env node
/**
 * Wächter für den Abbau der alten Farbklassen (docs/wissen/design-regeln.md, Abschnitte 1, 6 und 7):
 * Die Zahl der Vorkommen je Muster in `web/src` darf nur sinken. Neuer Code nimmt die `ak-*`-Tokens.
 * Vorbild: tools/umfang-pruefen.mjs mit tools/umfang-grenzen.json.
 *
 * Aufruf:
 *   node tools/design-klassen.mjs                  prüfen (Exit 1, wenn ein Muster über seiner Grenze liegt)
 *   node tools/design-klassen.mjs --liste          Datei:Zeile je Muster
 *   node tools/design-klassen.mjs --festschreiben  gesunkene Werte übernehmen (erhöht nie); nur der Bestandsbau
 *                                                  (tools/commit-data.sh), nie ein PR — sonst kollidieren die PRs in der Datei
 *   --quelle <ordner> --grenzen <datei>            andere Wurzel (für den Test)
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const WURZEL = resolve(import.meta.dirname, '..')

/** Farbnamen, die das Token-System ersetzt hat (Abschnitt 1). */
const FARBEN = ['slate', 'sky', 'amber', 'emerald', 'rose', 'red', 'blue', 'indigo', 'violet', 'teal', 'orange', 'yellow']

// Hex-Werte sind in diesen Dateien gewollt (Anbieter- und Flaggenfarben); styles.css hält die Tokenwerte.
const HINWEIS =
  'Wird nur von tools/design-klassen.mjs --festschreiben gesenkt (Bestandsbau, tools/commit-data.sh), nie von Hand erhöht. Ausgangswerte 14.10.2026.'

const HEX_AUSNAHMEN = /(^|\/)(detail\/pillen\.tsx|filter\/Flagge\.tsx|de-flagge\.tsx|styles\.css)$/

/** Je Muster: Name, Regex, optional ein Filter auf den Pfad relativ zu `web/src`. */
export const MUSTER = [
  ...FARBEN.map((f) => ({ name: `${f}-`, regex: new RegExp(`\\b${f}-`, 'g') })),
  { name: 'white/', regex: /\bwhite\//g },
  { name: 'black/', regex: /\bblack\//g },
  { name: 'dark:', regex: /\bdark:/g },
  { name: 'focus-visible:ring', regex: /focus-visible:ring/g },
  { name: 'ring-sky', regex: /ring-sky/g },
  { name: 'opacity-30/40/50/60', regex: /\bopacity-(30|40|50|60)\b/g },
  ...['tsx', 'ts', 'css'].map(hexMuster),
]

/** Hex-Farben je Dateiart mit eigener Grenze, damit eine .ts oder .css nicht unter dem .tsx-Bestand durchrutscht. */
function hexMuster(endung) {
  return {
    name: `Hex in .${endung}`,
    // Nur gültige CSS-Längen (3, 4, 6, 8 Stellen): „#12369“ in einer Anschrift ist keine Farbe.
    regex: /(?<![\w&])#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b/gi,
    gilt: (pfad) => pfad.endsWith(`.${endung}`) && !HEX_AUSNAHMEN.test(pfad),
  }
}

function dateien(ordner) {
  return readdirSync(ordner, { withFileTypes: true }).flatMap((e) => {
    const pfad = join(ordner, e.name)
    if (e.isDirectory()) return dateien(pfad)
    return /\.(tsx?|css)$/.test(e.name) ? [pfad] : []
  })
}

/** Alle Fundstellen je Muster: `{ [name]: ['pfad:zeile', …] }`, Pfade relativ zu `quelle`. */
export function fundstellen(quelle) {
  const funde = Object.fromEntries(MUSTER.map((m) => [m.name, []]))
  for (const datei of dateien(quelle)) {
    const pfad = relative(quelle, datei).replaceAll('\\', '/')
    const text = readFileSync(datei, 'utf8')
    for (const m of MUSTER) {
      if (m.gilt && !m.gilt(pfad)) continue
      for (const treffer of text.matchAll(m.regex)) {
        funde[m.name].push(`${pfad}:${text.slice(0, treffer.index).split('\n').length}`)
      }
    }
  }
  return funde
}

/** Zahlen je Muster, die über der Grenze liegen (ein fehlendes Muster in der Grenzdatei erlaubt 0). */
export function zuViel(zahlen, erlaubt) {
  return Object.entries(zahlen)
    .filter(([name, n]) => n > (erlaubt[name] ?? 0))
    .map(([name, n]) => `${name}: ${n} statt höchstens ${erlaubt[name] ?? 0}`)
}

/** Neue Grenzen: nur gesunkene Werte, nie ein höherer. */
export function gesenkt(zahlen, erlaubt) {
  const neu = { ...erlaubt }
  for (const [name, n] of Object.entries(zahlen)) {
    if (n < (erlaubt[name] ?? Infinity)) neu[name] = n
  }
  return neu
}

function argument(name, vorgabe) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? resolve(process.argv[i + 1]) : vorgabe
}

/** Grenzdatei lesen: `null`, wenn es sie nicht gibt; Fehler, wenn sie da, aber unlesbar ist (kein stilles Neuschreiben ohne Sperre). */
function lesen(datei) {
  let text
  try {
    text = readFileSync(datei, 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT') return null
    throw e
  }
  const inhalt = JSON.parse(text)
  if (typeof inhalt?.vorkommen !== 'object' || inhalt.vorkommen === null) throw new Error('Feld „vorkommen“ fehlt')
  return inhalt
}

function grenzen(grenzDatei) {
  try {
    return { datei: lesen(grenzDatei) }
  } catch (e) {
    console.error(`✖ Grenzdatei ${grenzDatei} ist unlesbar (${e.message}). Nichts geschrieben; aus git wiederherstellen.`)
    return null
  }
}

function main() {
  const quelle = argument('--quelle', join(WURZEL, 'web/src'))
  const grenzDatei = argument('--grenzen', join(WURZEL, 'tools/design-klassen-grenzen.json'))
  const funde = fundstellen(quelle)
  const zahlen = Object.fromEntries(Object.entries(funde).map(([name, liste]) => [name, liste.length]))

  if (process.argv.includes('--liste')) {
    for (const [name, liste] of Object.entries(funde)) console.log(`${String(liste.length).padStart(5)}  ${name}\n${liste.map((f) => `         ${f}`).join('\n')}`)
    return 0
  }

  const gelesen = grenzen(grenzDatei)
  if (!gelesen) return 1
  const datei = gelesen.datei
  const erlaubt = datei?.vorkommen ?? {}
  if (process.argv.includes('--festschreiben')) {
    const zuhoch = zuViel(zahlen, erlaubt)
    if (datei && zuhoch.length) {
      console.error('Festschreiben erhöht nie. Erst die Klassen abbauen:\n  ' + zuhoch.join('\n  '))
      return 1
    }
    const neu = { _hinweis: HINWEIS, vorkommen: gesenkt(zahlen, erlaubt) }
    writeFileSync(grenzDatei, JSON.stringify(neu, null, 2) + '\n')
    console.log('Gesunkene Werte übernommen.')
    return 0
  }

  const zuhoch = zuViel(zahlen, erlaubt)
  if (zuhoch.length) {
    console.error(
      `✖ Alte Farbklassen in web/src sind mehr geworden:\n  ${zuhoch.join('\n  ')}\n\n` +
        'Neuer Code nimmt die ak-*-Tokens (docs/wissen/design-regeln.md), kein slate/sky, kein dark:-Paar, keinen Hex-Wert.\n' +
        'Fundstellen: node tools/design-klassen.mjs --liste. Die Grenzen werden nicht angehoben.',
    )
    return 1
  }
  const gesunken = JSON.stringify(gesenkt(zahlen, erlaubt)) !== JSON.stringify(erlaubt)
  console.log(`Farbklassen in Ordnung.${gesunken ? ' Gesunken — der nächste Bestandsbau auf main übernimmt das; im PR nicht festschreiben.' : ''}`)
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main())
