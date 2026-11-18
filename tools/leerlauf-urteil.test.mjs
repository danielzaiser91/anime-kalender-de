/** Test des Leerlauf-Urteils (`leerlauf-urteil.mjs`): feste Messwerte, je Grenze ein roter Fall und der Grenzwert selbst. */
import assert from 'node:assert/strict'
import { CPU_GRENZE, INTERVALL_MIN_MS, LECK_GRENZE_BYTES, urteil } from './leerlauf-urteil.mjs'

const ruhig = (extra = {}) => ({ name: 'Kalender', cpu: 0.0007, intervalle: [], animationen: [], ...extra })
const leck = (delta) => ({ vorher: 20e6, nachher: 20e6 + delta, wechsel: 20 })

assert.deepEqual(urteil([ruhig()], leck(0)), [], 'Basis vom 18.11.2026: grün')
assert.equal(urteil([], leck(0)).length, 1, 'ohne Ansicht rot')
assert.equal(urteil([ruhig()]).length, 1, 'ohne Leck-Messung rot')
assert.equal(urteil([ruhig({ cpu: CPU_GRENZE - 1e-6 })], leck(0)).length, 0, 'CPU knapp unter 1 %: grün')
assert.equal(urteil([ruhig({ cpu: CPU_GRENZE })], leck(0)).length, 1, 'CPU genau 1 %: rot')
assert.equal(urteil([ruhig({ cpu: NaN })], leck(0)).length, 1, 'CPU nicht messbar: rot')
assert.match(urteil([ruhig({ intervalle: [{ takt: 300, ort: 'x' }] })], leck(0))[0], /Intervall 300 ms/, 'der 300-ms-Takt im Leerlauf: rot')
assert.equal(urteil([ruhig({ intervalle: [{ takt: INTERVALL_MIN_MS - 1, ort: 'x' }] })], leck(0)).length, 1, '999 ms: rot')
assert.equal(urteil([ruhig({ intervalle: [{ takt: INTERVALL_MIN_MS, ort: 'x' }, { takt: 30000, ort: 'y' }] })], leck(0)).length, 0, '1 s und 30 s: grün')
assert.match(urteil([ruhig({ animationen: ['dreh'] })], leck(0))[0], /unendliche Animation/, 'Dauer-Animation: rot')
assert.equal(urteil([ruhig()], leck(LECK_GRENZE_BYTES)).length, 0, 'Heap genau +1 MB: grün')
assert.match(urteil([ruhig()], leck(LECK_GRENZE_BYTES + 1))[0], /Heap nach 20 Wechseln/, 'Heap 1 Byte über 1 MB: rot')
assert.equal(urteil([ruhig()], { vorher: 1, nachher: NaN, wechsel: 20 }).length, 1, 'Heap nicht messbar: rot')
assert.equal(urteil([ruhig(), ruhig({ name: 'Datenbank', cpu: 0.02 })], leck(0)).length, 1, 'jede Ansicht zählt, nicht nur die erste')
console.log('leerlauf-urteil: 14 Fälle ✓')
