/**
 * Test für `tools/ladezeiten-grenzen.mjs`: Grenze = Median × 1,5; Urteil bei Gleichstand, Überschreitung und fehlendem Wert.
 */
import assert from 'node:assert/strict'
import { MEDIAN_HEUTE, grenzeVon, urteile } from './ladezeiten-grenzen.mjs'

const erster = (zahlen) => zahlen[0]
const namen = Object.keys(MEDIAN_HEUTE)
assert.ok(namen.includes('Kalender sichtbar') && namen.includes('Panel auf'), 'Pflicht-Messgrößen fehlen')
assert.equal(grenzeVon(100), 150)

const aufGrenze = new Map(namen.map((n) => [n, [grenzeVon(MEDIAN_HEUTE[n])]]))
assert.ok(urteile(aufGrenze, erster).every((u) => u.ok), 'genau auf der Grenze ist erlaubt')

const darueber = new Map(namen.map((n) => [n, [grenzeVon(MEDIAN_HEUTE[n]) + 1]]))
assert.ok(urteile(darueber, erster).every((u) => !u.ok), 'eine Millisekunde darüber ist zu langsam')

const fehlt = new Map(aufGrenze)
fehlt.delete(namen[0])
assert.equal(urteile(fehlt, erster)[0].ok, false, 'eine nicht gemessene Größe ist nie grün')
console.log('ladezeiten-grenzen.test: ok')
