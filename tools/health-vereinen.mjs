#!/usr/bin/env node
/**
 * Führt zwei Fassungen von `data/source-health.json` zusammen: je Quelle gilt der Eintrag mit dem jüngeren `lastRun`.
 * Aufruf: node tools/health-vereinen.mjs <Zieldatei> <andere Fassung>   — das Ergebnis steht in der Zieldatei.
 *
 * Anlass (05.10.2026): Mehrere Läufe schreiben dieselbe Datei, jeder seine eigenen Schlüssel. Als Textdatei führte das zu Konflikten oder zu einem
 * Überschreiben des fremden Stands; als Schlüsselliste ist es eindeutig.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const [ziel, andere] = process.argv.slice(2)
if (!ziel || !andere) {
  console.error('Aufruf: node tools/health-vereinen.mjs <Zieldatei> <andere Fassung>')
  process.exit(2)
}
const lies = (pfad) => {
  try {
    return JSON.parse(readFileSync(pfad, 'utf8'))
  } catch {
    return {}
  }
}
const a = lies(ziel)
const b = lies(andere)
const jung = (e) => Date.parse(e?.lastRun ?? '') || 0
const raus = { ...a }
for (const [name, eintrag] of Object.entries(b)) if (!raus[name] || jung(eintrag) >= jung(raus[name])) raus[name] = eintrag
writeFileSync(ziel, JSON.stringify(raus, null, 2))
