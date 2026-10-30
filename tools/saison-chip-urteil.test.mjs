/** Test der Urteilsregeln `saison-chip-urteil.mjs` aus festen Messwerten. Aufruf: node tools/saison-chip-urteil.test.mjs */
import assert from 'node:assert/strict'
import { urteilKarte, urteilSeite } from './saison-chip-urteil.mjs'

const gut = { knopfHoehe: 105, knopfRechts: 340, chipsRechts: [120, 200], zeileRechts: 210, gestrichelt: 1, laut: true }
assert.deepEqual(urteilKarte(gut, 'gekennzeichnet'), [])
assert.deepEqual(urteilKarte({ ...gut, zeileRechts: null, gestrichelt: 0, laut: false }, 'belegt'), [])
assert.equal(urteilKarte({ ...gut, knopfHoehe: 43 }, 'gekennzeichnet').length, 1, 'zu niedrig')
assert.equal(urteilKarte({ ...gut, knopfHoehe: 44 }, 'gekennzeichnet').length, 0, 'genau 44')
assert.equal(urteilKarte({ ...gut, chipsRechts: [341] }, 'gekennzeichnet').length, 1, 'Chip ragt über')
assert.equal(urteilKarte({ ...gut, chipsRechts: [340.4] }, 'gekennzeichnet').length, 0, 'Rundung')
assert.equal(urteilKarte({ ...gut, zeileRechts: 341 }, 'gekennzeichnet').length, 1, 'Zeile ragt über')
assert.equal(urteilKarte({ ...gut, gestrichelt: 0 }, 'gekennzeichnet').length, 1, 'gestrichelt fehlt')
assert.equal(urteilKarte({ ...gut, laut: false }, 'gekennzeichnet').length, 1, 'Zeile fehlt')
assert.equal(urteilKarte(gut, 'belegt').length, 1, 'belegte Karte mit Kennzeichnung')
assert.equal(urteilKarte({ ...gut, laut: false, gestrichelt: 0 }, 'gekennzeichnet').length, 1)
assert.deepEqual(urteilSeite(360, 360), [])
assert.equal(urteilSeite(361, 360).length, 1)
console.log('saison-chip-urteil: alle Zusicherungen ok')
