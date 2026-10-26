/* Feste Pixelfarben; Sollwerte stehen hier, nicht im Modul. */
import assert from 'node:assert/strict'
import { duellFehler, messpunkte } from './duell-urteil.mjs'

const GRUND = [10, 11, 68]
const GRUEN = [30, 160, 90]
const ROT = [200, 50, 60]
const zustand = (unten, ring) => ({ unten, farben: [GRUND, GRUND, GRUND, GRUND, ring] })
const gut = () => ({ ohne: zustand(500, GRUND), gewinnt: zustand(500, GRUEN), verliert: zustand(500, ROT) })

assert.deepEqual(duellFehler(gut()), [], 'rund, gleiche Unterkante, Ringe unten sichtbar')

const eckig = gut()
eckig.gewinnt.farben = [GRUEN, GRUND, GRUND, GRUND, GRUEN]
assert.deepEqual(duellFehler(eckig), ['gewinnt: obere linke Ecke ist nicht rund (Pixel zeigt nicht den Hintergrund)'], 'Ecke nur im Zustand gewinnt eckig')

const eckigUnten = gut()
eckigUnten.verliert.farben = [GRUND, GRUND, ROT, GRUND, ROT]
assert.deepEqual(duellFehler(eckigUnten), ['verliert: untere rechte Ecke ist nicht rund'], 'Ecke unten rechts im Zustand verliert eckig')

const verschoben = gut()
verschoben.verliert.unten = 502
assert.deepEqual(duellFehler(verschoben), ['verliert: Unterkante der Karte verschiebt sich (500 → 502)'], 'Unterkante verschiebt sich um 2 px')
const eins = gut()
eins.gewinnt.unten = 501
assert.equal(duellFehler(eins).length, 1, 'schon 1 px Verschiebung zählt')

const abgeschnitten = gut()
abgeschnitten.gewinnt.farben[4] = [GRUND[0] + 10, GRUND[1] + 10, GRUND[2] + 10]
assert.deepEqual(duellFehler(abgeschnitten), ['gewinnt: Ring unter der Unterkante fehlt (abgeschnitten)'], 'Ring des Siegers fehlt')

const gleichFarbe = gut()
gleichFarbe.verliert.farben[4] = GRUEN
assert.deepEqual(duellFehler(gleichFarbe), ['Sieger- und Verlierer-Ring unten haben dieselbe Farbe'], 'beide Ringe gleich')

const knapp = gut()
knapp.gewinnt.farben[4] = [GRUND[0] + 39, GRUND[1], GRUND[2]]
assert.equal(duellFehler(knapp).filter((f) => f.startsWith('gewinnt: Ring')).length, 1, 'Abstand 39 ist zu wenig')
knapp.gewinnt.farben[4] = [GRUND[0] + 40, GRUND[1], GRUND[2]]
assert.equal(duellFehler(knapp).filter((f) => f.startsWith('gewinnt: Ring')).length, 0, 'Abstand genau 40 genügt')

/* Messpunkte: ganzzahliges Rechteck (Handy aus der Messung), Rechteck mit Nachkommastellen (Rechner), Kante genau auf halbem Pixel. */
assert.deepEqual(messpunkte({ x: 16, y: 140, w: 328, h: 258 }), [[16, 140], [15, 139], [343, 397], [344, 398], [180, 400]], 'ganzzahlig')
assert.deepEqual(messpunkte({ x: 245.890625, y: 158, w: 433.65625, h: 650.5 }), [[246, 158], [245, 157], [679, 807], [680, 808], [463, 810]], 'Nachkommastellen')
assert.deepEqual(messpunkte({ x: 16.5, y: 10.5, w: 20, h: 30 }), [[17, 11], [16, 10], [35, 39], [36, 40], [27, 42]], 'Kante genau auf Pixelmitte zählt als außen')
console.log('duell-urteil: ok (Ecken je Zustand, Unterkante ±1 px, Ring unten Schwelle 39/40, Ringfarben, Messpunkte)')
