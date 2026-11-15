/**
 * Schreibt tools/kennzahlen/daten.js (window.KENNZAHLEN_DATEN) aus tage.jsonl, massnahmen.yaml und kernpunkte.yaml.
 * Als JS statt JSON, damit kennzahlen.html unter file:// ohne fetch läuft.   node tools/kennzahlen-daten-erzeugen.mjs
 * `tageskennzahlen.mjs` ruft `aktualisiereAnsicht` am Ende selbst auf (ein Befehl schreibt tage.jsonl, kernpunkte.yaml und daten.js).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import { baueAnsichtsDaten } from './kennzahlen-aufbereiten.mjs'
import { aktualisiereKernpunkte } from './kennzahlen-kernpunkte.mjs'

const ORDNER = resolve(dirname(fileURLToPath(import.meta.url)), 'kennzahlen')

export function leseAlles(ordner = ORDNER) {
  const tage = readFileSync(resolve(ordner, 'tage.jsonl'), 'utf8').split('\n').filter(Boolean).map((z) => JSON.parse(z))
  const massnahmen = yaml.load(readFileSync(resolve(ordner, 'massnahmen.yaml'), 'utf8'), { schema: yaml.CORE_SCHEMA }).massnahmen
  const kp = resolve(ordner, 'kernpunkte.yaml')
  const kernpunkte = existsSync(kp) ? yaml.load(readFileSync(kp, 'utf8'), { schema: yaml.CORE_SCHEMA }) ?? {} : {}
  return { tage, massnahmen, kernpunkte }
}

/** Inhalt von daten.js; „, “ mit Leerzeichen, damit der Leerzeichen-Wächter der Hooks die Zeile nicht als Tippfehler liest. */
export function erzeugeDatenJs(ordner = ORDNER) {
  const { tage, massnahmen, kernpunkte } = leseAlles(ordner)
  return `window.KENNZAHLEN_DATEN = ${JSON.stringify(baueAnsichtsDaten(tage, massnahmen, kernpunkte)).replace(/,/g, ', ')}\n`
}

export function schreibeDatenJs(ordner = ORDNER) {
  writeFileSync(resolve(ordner, 'daten.js'), erzeugeDatenJs(ordner))
}

/** Ein Befehl für den Tagesbericht: Kernpunkte aus den Berichten nachziehen, daten.js neu schreiben. */
export function aktualisiereAnsicht() {
  aktualisiereKernpunkte()
  schreibeDatenJs()
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  schreibeDatenJs()
  const { tage, massnahmen } = leseAlles()
  console.log(`daten.js: ${tage.length} Tage, ${massnahmen.length} Maßnahmen`)
}
