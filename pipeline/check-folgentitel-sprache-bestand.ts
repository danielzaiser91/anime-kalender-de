/**
 * Bestand zur Regel „nur deutsche Folgentitel" (Daniel, F57, 24.10.2026): Keine Zeile in `public/data/folgen/<id>.json` trägt den englischen oder
 * japanischen Titel, den aniSearch führt, wo es keinen deutschen gibt (`fremdtitelZahl`, Herkunft über das Quellfeld, nicht über eine Wortliste).
 * Liest den gebauten Bestand, deshalb `check:bestand`.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { fremdtitelZahl, type FolgeQuelle } from './bau/folgentitel-zeilen.ts'

const roh = JSON.parse(readFileSync('data/anisearch-folgen.json', 'utf8')) as Record<string, { folgen?: FolgeQuelle[] }>
const zuordnung = JSON.parse(readFileSync('data/anisearch.json', 'utf8')) as Record<string, { anisearchId?: number }>

let listen = 0
let titel = 0
let fremd = 0
for (const datei of readdirSync('public/data/folgen').filter((f) => /^\d+\.json$/.test(f))) {
  const id = datei.slice(0, -5)
  const liste = JSON.parse(readFileSync(`public/data/folgen/${datei}`, 'utf8')) as { f: [number, string][] }
  const asId = zuordnung[id]?.anisearchId
  const zahl = fremdtitelZahl(liste.f, asId ? (roh[String(asId)]?.folgen ?? []) : [])
  listen++
  titel += liste.f.filter(([, t]) => t).length
  fremd += zahl
  if (zahl) console.error(`FEHLER: ${id}: ${zahl} Folgentitel aus englischer oder japanischer Quelle`)
}

/* Untergrenze, sonst ist ein Wächter ohne Daten grün: 1.807 Listen und 36.747 deutsche Titel am 24.10.2026. */
if (listen < 1000 || titel < 20000) {
  fremd++
  console.error(`FEHLER: nur ${listen} Listen mit ${titel} Titeln gelesen — der Wächter misst nichts`)
}

console.log(`check-folgentitel-sprache-bestand: ${fremd ? `${fremd} Fehler` : 'ok'} (${listen} Folgenlisten, ${titel} deutsche Titel, 0 fremdsprachige erlaubt)`)
process.exit(fremd ? 1 : 0)
