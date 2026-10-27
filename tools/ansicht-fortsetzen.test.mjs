/* Feste Rechtecke; Sollwerte stehen hier, nicht im Modul. */
import assert from 'node:assert/strict'
import { teilungsFehler } from './ansicht-fortsetzen.mjs'

const quer = (aw, bw) => ({ a: { x: 16, y: 80, w: aw, h: 600 }, b: { x: 16 + aw + 12, y: 80, w: bw, h: 600 }, breite: 1440 })
const hoch = (ah, bh) => ({ a: { x: 16, y: 80, w: 343, h: ah }, b: { x: 16, y: 80 + ah + 12, w: 343, h: bh }, breite: 375 })

assert.deepEqual(teilungsFehler(quer(938.4, 402.6)), [], 'Rechner 70 zu 30')
assert.deepEqual(teilungsFehler(hoch(466.2, 199.8)), [], 'Handy 70 zu 30')
assert.deepEqual(teilungsFehler(quer(926.8, 421)), ['Teilung 68.8 zu 31.2 statt 70 zu 30'], 'Rechner 68,8 ist zu weit weg')
assert.deepEqual(teilungsFehler(quer(938.4 + 13.4, 402.6 - 13.4)), [], 'Rechner genau an der Grenze (71 %) noch in Ordnung')
assert.equal(teilungsFehler(quer(938.4 + 14.1, 402.6 - 14.1)).length, 1, 'Rechner knapp über der Grenze (71,05 %)')
assert.equal(teilungsFehler(quer(402.6, 938.4)).length, 1, 'vertauscht 30 zu 70')
assert.equal(teilungsFehler(hoch(350, 316)).length, 1, 'Handy 52,6 zu 47,4')
assert.deepEqual(teilungsFehler({ ...quer(938.4, 402.6), breite: 375 }), ['am Handy stehen die Teile nicht übereinander'], 'Handy-Breite, aber nebeneinander')
assert.deepEqual(teilungsFehler({ ...hoch(466.2, 199.8), breite: 1440 }), ['am Rechner stehen die Teile nicht nebeneinander'], 'Rechner-Breite, aber übereinander')
assert.equal(teilungsFehler({ ...quer(938.4, 402.6), breite: 900 }).length, 0, 'ab 900 px nebeneinander')
assert.equal(teilungsFehler({ ...quer(938.4, 402.6), breite: 899 }).length, 1, 'bei 899 px übereinander verlangt')
const ueber = quer(938.4, 402.6)
ueber.b.x = 500
assert.ok(teilungsFehler(ueber).includes('die Teile überlappen sich'), 'Überlappung')

console.log('ansicht-fortsetzen: ok (70 zu 30 mit Toleranz 1 %, quer ab 900 px, hoch darunter, Überlappung)')
