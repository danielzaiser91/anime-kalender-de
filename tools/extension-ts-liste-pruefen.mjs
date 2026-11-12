#!/usr/bin/env node
/**
 * Wächter für die `include`-Liste von `extension/tsconfig.json` (C2a).
 * Jede `extension/*.js` (ohne erzeugte `offene-*.js`) steht in `include` (tsc prüft sie)
 * oder in AUSNAHMEN (bekannte Typfehler). Sonst bliebe eine neue Datei still ungeprüft.
 * AUSNAHMEN darf nur schrumpfen: Eine Datei, die in `include` steht oder nicht mehr
 * existiert, muss hier raus; neue Einträge verlangt der Wächter nie von selbst.
 * Aufruf: node tools/extension-ts-liste-pruefen.mjs [wurzel]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Stand 12.11.2026: 22 Dateien mit Typfehlern bei der Messung für C2a.
export const AUSNAHMEN = [
  'adn-leser.js',
  'adn.js',
  'amazon-knopf-zeichnen.js',
  'amazon-leser.js',
  'amazon.js',
  'box.js',
  'disney-durchgang.js',
  'disney-leser.js',
  'disney-netz.js',
  'disney-weg.js',
  'disney.js',
  'leser.js',
  'melder.js',
  'netflix-gemeldet.js',
  'netflix-profilwahl.js',
  'netflix-protokoll.js',
  'netflix-randvoll.js',
  'netflix-zurueckgestellt.js',
  'optionen.js',
  'protokoll.js',
  'ruhig.js',
  'tageslimit.js',
]

export function urteil(dateien, include, ausnahmen) {
  const fehler = []
  for (const f of dateien) {
    const drin = include.includes(f)
    const aus = ausnahmen.includes(f)
    if (!drin && !aus) fehler.push(`${f}: weder in extension/tsconfig.json include noch in AUSNAHMEN`)
    if (drin && aus) fehler.push(`${f}: steht in include und in AUSNAHMEN, Ausnahme streichen`)
  }
  for (const a of ausnahmen) if (!dateien.includes(a)) fehler.push(`${a}: Ausnahme ohne Datei, streichen`)
  for (const i of include) if (!dateien.includes(i)) fehler.push(`${i}: include ohne Datei`)
  return fehler
}

export function pruefe(wurzel) {
  const ordner = path.join(wurzel, 'extension')
  const dateien = fs.readdirSync(ordner).filter((f) => f.endsWith('.js') && !f.startsWith('offene-'))
  const roh = fs.readFileSync(path.join(ordner, 'tsconfig.json'), 'utf8').replace(/^\s*\/\/.*$/gm, '')
  const include = JSON.parse(roh).include
  return { fehler: urteil(dateien, include, AUSNAHMEN), dateien: dateien.length, include: include.length }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const wurzel = process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const { fehler, dateien, include } = pruefe(wurzel)
  for (const f of fehler) console.error(`✗ ${f}`)
  console.log(`extension-ts-liste: ${dateien} Dateien, ${include} in include, ${AUSNAHMEN.length} Ausnahmen, ${fehler.length} Fehler`)
  process.exit(fehler.length ? 1 : 0)
}
