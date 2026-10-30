/**
 * Zuordnungsbilanz: vergleicht die Zuordnung Plattform-Adresse -> Titelkennung zweier Stände der Meldungskopie
 * (`tools/meldungskopie.mjs`, nie die echte D1) und druckt eine Zeile je Adresse.
 * Ein "Stand" ist eine SQLite-Kopie: die Kopie vor und nach einer Einspiel-SQL-Probe (Kopie des Kopierordners
 * mit `abfrage --datei` bearbeiten, oder zwei Kopien verschiedener Tage). Zuordnung = die `titel_id` der Zeilen
 * aus `pruefung` und `prime_folge` (alle Plattformen außer Netflix/Disney+) und der Sicht `pruefung_titel` (nur
 * Netflix/Disney+: deren Altzeilen enden am 13.10.2026, betrieb.md "Meldungskopie"); eine Adresse mit mehreren
 * Staffeln trägt eine Menge.
 * Klassen: neu (vorher keine Kennung), verloren (nachher keine), umgezogen (andere Menge), gleich (gleiche Kennung),
 * ohne (in beiden Ständen keine Kennung; zählt nicht als "gleich").
 * Eine Kopie älter als 48 h bekommt eine Warnzeile (Datei-Zeitstempel).
 * Aufruf: node tools/zuordnungsbilanz.mjs <alt.sqlite> [<neu.sqlite>] [--gleich]
 *   ohne <neu.sqlite> gilt der Standardort data/cache/meldungskopie/meldungen.sqlite; "gleich" druckt nur mit --gleich.
 */
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const WURZEL = join(fileURLToPath(import.meta.url), '..', '..')
export const STANDARD_KOPIE = join(WURZEL, 'data', 'cache', 'meldungskopie', 'meldungen.sqlite')
export const KLASSEN = ['neu', 'umgezogen', 'verloren', 'gleich', 'ohne']
export const ALTER_GRENZE_STUNDEN = 48

const TITELZEILE = "('netflix', 'disneyplus')"
const ABFRAGEN = [
  `SELECT plattform, url, titel_id FROM pruefung WHERE plattform NOT IN ${TITELZEILE}`,
  `SELECT plattform, url, titel_id FROM prime_folge WHERE plattform NOT IN ${TITELZEILE}`,
  `SELECT plattform, url, titel_id FROM pruefung_titel`,
]

/** Adresse ("plattform url") -> sortierte Liste der Titelkennungen; eine Adresse ohne Kennung bleibt mit leerer Liste erhalten. */
export function leseZuordnung(pfad) {
  const db = new DatabaseSync(pfad, { readOnly: true })
  try {
    const karte = new Map()
    for (const sql of ABFRAGEN) {
      for (const z of db.prepare(sql).iterate()) {
        const schluessel = `${z.plattform} ${z.url}`
        if (!karte.has(schluessel)) karte.set(schluessel, new Set())
        if (z.titel_id != null) karte.get(schluessel).add(z.titel_id)
      }
    }
    return new Map([...karte].map(([k, m]) => [k, [...m].sort((a, b) => a - b)]))
  } finally {
    db.close()
  }
}

const gleich = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])

/** Klasse einer Adresse; fehlt sie in einem Stand, zählt das wie "keine Kennung". */
export function klasseVon(alt, neu) {
  if (gleich(alt, neu)) return alt.length === 0 ? 'ohne' : 'gleich'
  if (alt.length === 0) return 'neu'
  if (neu.length === 0) return 'verloren'
  return 'umgezogen'
}

/** Eine Zeile je Adresse beider Stände: { adresse, klasse, alt, neu }, nach Adresse sortiert. */
export function vergleiche(alt, neu) {
  const adressen = [...new Set([...alt.keys(), ...neu.keys()])].sort()
  return adressen.map((adresse) => {
    const a = alt.get(adresse) ?? []
    const n = neu.get(adresse) ?? []
    return { adresse, klasse: klasseVon(a, n), alt: a, neu: n }
  })
}

export function summen(zeilen) {
  const s = Object.fromEntries(KLASSEN.map((k) => [k, 0]))
  for (const z of zeilen) s[z.klasse]++
  return s
}

/** Warnzeilen für Kopien, deren Datei-Zeitstempel (`mtimes`: Pfad -> ms) mehr als 48 h vor `jetztMs` liegt. */
export function alterswarnungen(mtimes, jetztMs) {
  return Object.entries(mtimes)
    .map(([pfad, ms]) => ({ pfad, stunden: Math.floor((jetztMs - ms) / 3600000) }))
    .filter((k) => k.stunden > ALTER_GRENZE_STUNDEN)
    .map((k) => `⚠ WARNUNG Kopie ${k.pfad} ist ${k.stunden} h alt (Grenze ${ALTER_GRENZE_STUNDEN} h)`)
}

/** Ausgabe: Summenzeile, dann je Adresse "klasse  alt -> neu  adresse"; "gleich" und "ohne" nur auf Wunsch. */
export function formatiere(zeilen, mitGleich = false) {
  const s = summen(zeilen)
  const kopf = `Zuordnungsbilanz: ${zeilen.length} Adressen — ${KLASSEN.map((k) => `${k} ${s[k]}`).join(', ')}`
  const liste = (l) => (l.length ? l.join('+') : '-')
  const sichtbar = zeilen.filter((z) => mitGleich || (z.klasse !== 'gleich' && z.klasse !== 'ohne'))
  return [kopf, ...sichtbar.map((z) => `${z.klasse.padEnd(9)} ${liste(z.alt)} -> ${liste(z.neu)}  ${z.adresse}`)].join('\n')
}

export function main(argv) {
  const mitGleich = argv.includes('--gleich')
  const pfade = argv.filter((a) => !a.startsWith('--'))
  const alt = pfade[0]
  const neu = pfade[1] ?? STANDARD_KOPIE
  if (!alt || !existsSync(alt) || !existsSync(neu)) {
    console.error('Aufruf: node tools/zuordnungsbilanz.mjs <alt.sqlite> [<neu.sqlite>] [--gleich]  (beide Dateien müssen existieren)')
    return 2
  }
  const mtimes = { [alt]: statSync(alt).mtimeMs, [neu]: statSync(neu).mtimeMs }
  for (const w of alterswarnungen(mtimes, Date.now())) console.log(w)
  console.log(formatiere(vergleiche(leseZuordnung(alt), leseZuordnung(neu)), mitGleich))
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)))
