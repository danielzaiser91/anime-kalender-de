/**
 * Schreibt tools/kennzahlen/daten.js (window.KENNZAHLEN_DATEN) aus tage.jsonl und massnahmen.yaml (optional kernpunkte.yaml).
 * Als JS statt JSON, damit kennzahlen.html unter file:// ohne fetch läuft.   node tools/kennzahlen-daten-erzeugen.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import { baueAnsichtsDaten } from './kennzahlen-aufbereiten.mjs'

const ORDNER = resolve(dirname(fileURLToPath(import.meta.url)), 'kennzahlen')

export function leseAlles(ordner = ORDNER) {
  const tage = readFileSync(resolve(ordner, 'tage.jsonl'), 'utf8').split('\n').filter(Boolean).map((z) => JSON.parse(z))
  const massnahmen = yaml.load(readFileSync(resolve(ordner, 'massnahmen.yaml'), 'utf8'), { schema: yaml.CORE_SCHEMA }).massnahmen
  const kp = resolve(ordner, 'kernpunkte.yaml')
  const kernpunkte = existsSync(kp) ? yaml.load(readFileSync(kp, 'utf8'), { schema: yaml.CORE_SCHEMA }) ?? {} : {}
  return { tage, massnahmen, kernpunkte }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { tage, massnahmen, kernpunkte } = leseAlles()
  const daten = baueAnsichtsDaten(tage, massnahmen, kernpunkte)
  writeFileSync(resolve(ORDNER, 'daten.js'), `window.KENNZAHLEN_DATEN = ${JSON.stringify(daten).replace(/,/g, ', ')}\n`)
  console.log(`daten.js: ${daten.tage.length} Tage, ${daten.kennzahlen.length} Kennzahlen, ${daten.marker.length} Marker`)
}
