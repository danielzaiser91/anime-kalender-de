/**
 * Prüft die Zuordnung von Anbieter-Blöcken zu unseren Titeln mit fester Eingabe:
 * ein Titel von uns, drei Blöcke (wie Avatar) — alle tragen Kennung, Offen-Stand und Zustand.
 * Aufruf: node tools/extension-block.test.mjs
 */
import assert from 'node:assert/strict'
import { blockStand, eintragZuBlock } from './extension-block.mjs'

const zustandVon = (e) => (e.dub === undefined ? { zustand: 'melden' } : { zustand: 'belegt', am: null })
const keinVerdacht = new Set()

const einer = [{ t: { id: -246 }, dub: true }]
for (const i of [0, 1, 2]) {
  assert.deepEqual(blockStand(einer, i, keinVerdacht, zustandVon), { id: -246, offen: false, zustand: 'belegt', am: null }, `Block ${i}`)
}
assert.deepEqual(blockStand([{ t: { id: 5 } }], 2, keinVerdacht, zustandVon), { id: 5, offen: true, zustand: 'melden' }, 'ohne Urteil: offen')
assert.equal(blockStand(einer, 1, new Set([-246]), zustandVon).offen, true, 'Verdachtsfall ist offen')

const zwei = [{ t: { id: 1 }, dub: true }, { t: { id: 2 } }]
assert.equal(eintragZuBlock(zwei, 1).t.id, 2, 'mehrere Titel: der Reihe nach')
assert.deepEqual(blockStand(zwei, 0, keinVerdacht, zustandVon), { offen: false, zustand: 'belegt', am: null }, 'mehrere Titel: keine Kennung am Block')
assert.deepEqual(blockStand(zwei, 2, keinVerdacht, zustandVon), { offen: true, zustand: 'melden' }, 'über das Ende hinaus: offen')
console.log('extension-block.test: grün')
