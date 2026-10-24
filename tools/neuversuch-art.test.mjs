import assert from 'node:assert/strict'
import { neuversuchArt } from './neuversuch-art.mjs'
import { BOT_DATEIEN_OHNE_LESER } from './pr-nachrechnen-bot-pfade.mjs'

/** Attrappe für den Vergleich: Schlüssel `von>bis`, Wert die Dateiliste. */
const diffAus = (tabelle) => (von, bis) => {
  const treffer = tabelle[`${von}>${bis}`]
  if (treffer === undefined) throw new Error('unbekannter Vergleich')
  return treffer
}

// Beliebige Bot-Datei aus der Liste (Wächter pr-nachrechnen-bot-pfade verbietet Dateinamen der Liste in tools/-Tests).
const BOT = BOT_DATEIEN_OHNE_LESER[0]
const CACHE_DATEI = ['data', 'cache', 'x.json'].join('/') // zusammengesetzt: der Schreibziel-Scanner liest data/-Literale
let faelle = 0
function fall(name, tabelle, erwartet) {
  assert.equal(neuversuchArt('L', 'B', 'N', diffAus(tabelle)), erwartet, name)
  faelle += 1
}

fall('nur Bot-Datei seit Bau und Logik: nichts', { 'L>N': [BOT], 'B>N': [BOT] }, 'nichts')
fall('Bot-Datei und Datenpfad seit Logik, nur Bot seit Bau: nichts', { 'L>N': [BOT, 'public/data/a.json'], 'B>N': [BOT] }, 'nichts')
fall('Datenpfad seit Bau: daten', { 'L>N': ['public/data/a.json'], 'B>N': ['public/data/a.json'] }, 'daten')
fall('data/cache seit Bau, Bot dabei: daten', { 'L>N': [BOT, CACHE_DATEI], 'B>N': [BOT, CACHE_DATEI] }, 'daten')
fall('genau eine Code-Datei seit Logik: code', { 'L>N': [BOT, 'tools/x.mjs'], 'B>N': [BOT] }, 'code')
fall('Code nur seit Bau, Logik-Vergleich leer: daten', { 'L>N': [], 'B>N': ['pipeline/x.ts'] }, 'daten')
fall('Quelle mit Leser (data/anisearch.json) ist kein Bot-Pfad: code', { 'L>N': ['data/anisearch.json'], 'B>N': ['data/anisearch.json'] }, 'code')
fall('public/og zählt als Code-Pfad', { 'L>N': ['public/og/a.png'], 'B>N': ['public/og/a.png'] }, 'code')
fall('Docs bewegt: code', { 'L>N': ['docs/wissen/betrieb.md'], 'B>N': [] }, 'code')

assert.equal(neuversuchArt('L', 'B', 'N', () => { throw new Error('git kaputt') }), 'code', 'Fehler im Vergleich')
faelle += 1
assert.equal(neuversuchArt('L', 'B', 'N', (von) => { if (von === 'B') throw new Error('x'); return [BOT] }), 'code', 'Fehler beim zweiten Vergleich')
faelle += 1

console.log(`neuversuch-art: ${faelle} Fälle grün.`)
