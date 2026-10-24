/**
 * Abrufdatum (`inhaltAm`) für den Altbestand der TMDB-Dateien `data/tmdb-poster.json`, `data/tmdb-banner.json`, `data/tmdb.json` (13.10.2026).
 *
 * Der Altbestand trug kein Datum. Als Abruftag gilt der Tag, an dem der Eintrag **zuerst im Git steht** (erster Commit mit demselben Wert):
 * geholt wurde er spätestens an diesem Tag, vermutlich kurz davor. Das ist die vorsichtige Seite (zu alt, nie zu jung): der Eintrag wird
 * eher erneuert als zu spät. Ein Eintrag, der in keinem Commit steht, bekommt den Tag des letzten Commits der Datei, sonst heute.
 *
 * Aufruf: `npx tsx tools/tmdb-bilddatum.mjs` (schreibt nur Einträge ohne `inhaltAm`; ein zweiter Lauf ändert nichts).
 * Die Beziehung „Datum ≤ erster Commit mit diesem Wert" rechnet `tools/tmdb-bilddatum-bestand.mjs` (`check:bestand-liste`) nach.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { hatInhalt } from '../pipeline/lib/tmdb-ablauf.ts'
import { todayIso } from '../shared/time.ts'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Die drei Dateien; `traegt`: welche Einträge ein Datum brauchen (`null` bei Plakat/Hintergrund = „TMDB hat keins" trägt kein Bild), `schoen`: Einrückung. */
export const DATEIEN = [
  { datei: 'data/tmdb-poster.json', traegt: (e) => e !== null, schoen: false },
  { datei: 'data/tmdb-banner.json', traegt: (e) => e !== null, schoen: false },
  { datei: 'data/tmdb.json', traegt: (e) => hatInhalt(e), schoen: true },
]

function sortiert(v) {
  if (Array.isArray(v)) return v.map(sortiert)
  if (v === null || typeof v !== 'object') return v
  return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortiert(v[k])]))
}

/** Der Eintrag ohne Datum in fester Schlüsselfolge: so vergleicht man „derselbe Wert" über Commits und Dateien hinweg. */
export function kanonisch(eintrag, mitStand = false) {
  const { inhaltAm, ...rest } = eintrag
  return JSON.stringify(sortiert(mitStand ? eintrag : rest))
}

/**
 * `verlauf`: Schnappschüsse der Datei, älteste zuerst (`{ tag, daten }`). Gibt den Tag des ersten mit demselben Wert zurück, sonst `undefined`;
 * mit `mitStand` zählt auch das Datum zum Wert (für die Prüfung, ob ein Datum vor seinem Commit liegt).
 */
export function erstesAuftreten(verlauf, id, eintrag, mitStand = false) {
  const soll = kanonisch(eintrag, mitStand)
  return verlauf.find((s) => s.daten[id] && kanonisch(s.daten[id], mitStand) === soll)?.tag
}

/** Alle Fassungen einer Datei aus dem Git, älteste zuerst; eine unlesbare Fassung wird übersprungen. */
export function verlaufAusGit(datei) {
  const git = (...args) => execFileSync('git', args, { cwd: wurzel, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  const zeilen = git('log', '--reverse', '--format=%H %cs', '--', datei).split('\n').filter(Boolean)
  const verlauf = []
  for (const zeile of zeilen) {
    const [hash, tag] = zeile.split(' ')
    try {
      verlauf.push({ tag, daten: JSON.parse(git('show', `${hash}:${datei}`)) })
    } catch {
      /* Fassung nicht lesbar: weiter */
    }
  }
  return verlauf
}

/** Trägt `inhaltAm` ein, wo es fehlt; gibt Zahl der Einträge, davon datierte und die Verteilung der Tage zurück. */
export function datiere(daten, traegt, verlauf, heute) {
  const letzter = verlauf.at(-1)?.tag ?? heute
  const tage = {}
  let datiert = 0
  let ersatz = 0
  for (const [id, e] of Object.entries(daten)) {
    if (!traegt(e) || e.inhaltAm) continue
    const tag = erstesAuftreten(verlauf, id, e)
    if (!tag) ersatz++
    e.inhaltAm = tag ?? letzter
    tage[e.inhaltAm] = (tage[e.inhaltAm] ?? 0) + 1
    datiert++
  }
  return { datiert, ersatz, tage }
}

function main() {
  const heute = todayIso()
  for (const { datei, traegt, schoen } of DATEIEN) {
    const daten = JSON.parse(readFileSync(join(wurzel, datei), 'utf8'))
    const r = datiere(daten, traegt, verlaufAusGit(datei), heute)
    writeFileSync(join(wurzel, datei), schoen ? JSON.stringify(daten, null, 2) : JSON.stringify(daten))
    console.log(`${datei}: ${Object.keys(daten).length} Einträge, ${r.datiert} datiert (${r.ersatz} ohne Commit-Fund), Tage ${JSON.stringify(r.tage)}`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
