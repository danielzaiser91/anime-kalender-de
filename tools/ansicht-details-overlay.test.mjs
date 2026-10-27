/* Feste Pixelfarben und Lagen; Sollwerte stehen hier, nicht im Modul. */
import assert from 'node:assert/strict'
import { overlayFehler } from './ansicht-details-overlay.mjs'

const GRUND = [194, 193, 243]
const BILD = [117, 116, 240]
const R = { x: 100, y: 200, w: 160, h: 240 }
const ruhig = { r: R, o: { ...R }, farben: [GRUND, GRUND, GRUND, GRUND, GRUND, GRUND, GRUND, GRUND], mitte: [200, 100, 50] }
const gut = () => ({ ruhig, an: { ...ruhig, mitte: [90, 45, 22] } })

assert.deepEqual(overlayFehler(gut()), [], 'sauberer Fall')

const mit = (aendere) => {
  const f = gut()
  aendere(f.an)
  return overlayFehler(f)
}
assert.deepEqual(mit((a) => (a.o = null)), ['Details-Overlay fehlt im Cover'], 'kein Overlay')
assert.deepEqual(mit((a) => (a.farben = [BILD, GRUND, GRUND, GRUND, ...a.farben.slice(4)])), ['mit Overlay: obere linke Ecke ist nicht rund (Pixel zeigt nicht den Hintergrund)'], 'obere Ecke eckig')
assert.deepEqual(mit((a) => (a.farben = [GRUND, GRUND, BILD, GRUND, ...a.farben.slice(4)])), ['mit Overlay: untere rechte Ecke ist nicht rund'], 'untere Ecke eckig')
for (const k of ['x', 'y', 'w', 'h']) {
  assert.deepEqual(mit((a) => (a.o = { ...a.o, [k]: a.o[k] + 2 })), [`Overlay deckt das Cover nicht genau (${k})`], `Lage ${k} um 2 daneben`)
  assert.deepEqual(mit((a) => (a.o = { ...a.o, [k]: a.o[k] - 2 })), [`Overlay deckt das Cover nicht genau (${k})`], `Lage ${k} um 2 zu klein`)
  assert.deepEqual(mit((a) => (a.o = { ...a.o, [k]: a.o[k] + 1 })), [], `Lage ${k} um genau 1 ist noch gedeckt`)
}
for (let i = 4; i < 8; i++) {
  assert.deepEqual(mit((a) => (a.farben = a.farben.map((f, j) => (j === i ? [GRUND[0] - 12, GRUND[1], GRUND[2]] : f)))), [`Zeile ${i - 3} unter dem Cover ändert sich mit Overlay`], `Zeile ${i - 3}: Abstand genau 12`)
  assert.deepEqual(mit((a) => (a.farben = a.farben.map((f, j) => (j === i ? [GRUND[0] - 11, GRUND[1], GRUND[2]] : f)))), [], `Zeile ${i - 3}: Abstand 11 bleibt gleich`)
}
assert.deepEqual(mit((a) => (a.mitte = [200, 100, 50])), ['Overlay dunkelt das Cover nicht ab'], 'Mitte gleich hell')
assert.deepEqual(mit((a) => (a.mitte = [200, 100, 49])), [], 'Mitte genau 1 dunkler genügt')
assert.deepEqual(mit((a) => (a.mitte = [250, 100, 50])), ['Overlay dunkelt das Cover nicht ab'], 'Mitte heller')
assert.equal(mit((a) => { a.o = { ...a.o, w: a.o.w + 9 }; a.mitte = [250, 100, 50] }).length, 2, 'zwei Fehler zugleich')

console.log('ansicht-details-overlay: ok (Ecken je Seite, Lage je Maß mit Toleranz 1, Zeilen darunter Schwelle 12, Abdunklung, fehlendes Overlay)')
