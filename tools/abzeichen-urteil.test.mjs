/** Test der Abzeichen-Regeln (`abzeichen-urteil.mjs`): jede Grenze und jeder Pixelfall einzeln, dazu ein sauberer Fall. Aufruf: node tools/abzeichen-urteil.test.mjs */
import assert from 'node:assert/strict'
import { lageFehler, pixelFehler } from './abzeichen-urteil.mjs'

const k = { l: 0, t: 0, r: 160, b: 280 }
const gut = { k, a: { l: 5, t: 5, r: 90, b: 25 }, s: { l: 1, t: 240, r: 159, b: 270 } }
assert.deepEqual(lageFehler(gut), [])
assert.equal(lageFehler({ ...gut, a: { ...gut.a, l: 3 } }).length, 1, 'links 3 px')
assert.equal(lageFehler({ ...gut, a: { ...gut.a, l: 4 } }).length, 0, 'links genau 4 px')
assert.equal(lageFehler({ ...gut, a: { ...gut.a, t: 3 } }).length, 1, 'oben 3 px')
assert.equal(lageFehler({ ...gut, a: { ...gut.a, r: 157 } }).length, 1, 'rechts 3 px')
assert.equal(lageFehler({ ...gut, a: { ...gut.a, b: 237 } }).length, 1, 'Streifen 3 px darunter')
assert.equal(lageFehler({ ...gut, a: { ...gut.a, b: 236 } }).length, 0, 'Streifen genau 4 px darunter')

const grau = [100, 100, 100]
const blau = [30, 60, 200]
const gleich = (ueber = {}) => ({ 'Kachelecke oben links': [grau, grau], 'Unterkante der Kachel': [grau, grau], 'Zeile unter dem Abzeichen': [grau, grau], ...ueber })
assert.deepEqual(pixelFehler({ gleich: gleich(), sichtbar: [blau, grau] }), [])
assert.equal(pixelFehler({ gleich: gleich({ 'Zeile unter dem Abzeichen': [blau, grau] }), sichtbar: [blau, grau] }).length, 1, 'Farbe läuft unter das Abzeichen')
assert.equal(pixelFehler({ gleich: gleich({ 'Kachelecke oben links': [[100, 100, 111], grau] }), sichtbar: [blau, grau] }).length, 0, 'Unterschied 11 gilt nicht')
assert.equal(pixelFehler({ gleich: gleich({ 'Kachelecke oben links': [[100, 100, 112], grau] }), sichtbar: [blau, grau] }).length, 1, 'Unterschied 12 gilt')
assert.equal(pixelFehler({ gleich: gleich(), sichtbar: [grau, grau] }).length, 1, 'Abzeichen unsichtbar')
assert.equal(pixelFehler({ gleich: gleich(), sichtbar: [[100, 100, 111], grau] }).length, 1, 'Mitte: Unterschied 11 reicht nicht')
assert.equal(pixelFehler({ gleich: gleich(), sichtbar: [[100, 100, 112], grau] }).length, 0, 'Mitte: Unterschied 12 reicht')
assert.equal(pixelFehler({ gleich: gleich({ 'Unterkante der Kachel': [blau, grau] }), sichtbar: [grau, grau] }).length, 2, 'zwei Fehler zugleich')
console.log('abzeichen-urteil: ok (Abstände 3/4 px je Seite, Streifen, Pixel 11/12, unsichtbar, zwei Fehler)')
