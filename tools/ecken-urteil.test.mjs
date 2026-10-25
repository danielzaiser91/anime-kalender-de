/* Feste Pixelfarben aus der Messung (dunkel und hell, Handy/Rechner); Sollwerte stehen hier, nicht im Modul. */
import assert from 'node:assert/strict'
import { eckenFehler } from './ecken-urteil.mjs'

const DUNKEL = { grund: [10, 11, 68], bild: [13, 16, 148] }
const HELL = { grund: [194, 193, 243], bild: [117, 116, 240] }

for (const [name, t] of Object.entries({ dunkel: DUNKEL, hell: HELL })) {
  const schatten = t.grund.map((v) => v - 2)
  assert.deepEqual(eckenFehler([t.grund, t.grund, schatten, t.grund]), [], `rund, Schatten 6 (3 je Kanal 2) (${name})`)
  assert.deepEqual(eckenFehler([t.grund, t.grund, [t.grund[0] - 4, t.grund[1], t.grund[2]], [t.grund[0] + 7, t.grund[1], t.grund[2]]]), [], `Abstand 11 bleibt rund (${name})`)
  assert.deepEqual(eckenFehler([t.bild, t.grund, t.grund, t.grund]), ['obere linke Ecke ist nicht rund (Pixel zeigt nicht den Hintergrund)'], `nur oben links eckig (${name})`)
  assert.deepEqual(eckenFehler([t.grund, t.grund, t.bild, t.grund]), ['untere rechte Ecke ist nicht rund'], `nur unten rechts eckig (${name})`)
  assert.equal(eckenFehler([t.bild, t.grund, t.bild, t.grund]).length, 2, `beide eckig (${name})`)
  const knapp = [t.grund[0] + 12, t.grund[1], t.grund[2]]
  assert.equal(eckenFehler([knapp, t.grund, t.grund, t.grund]).length, 1, `Abstand genau 12 ist eckig, oben links (${name})`)
  assert.equal(eckenFehler([t.grund, t.grund, knapp, t.grund]).length, 1, `Abstand genau 12 ist eckig, unten rechts (${name})`)
}
/* Bildinhalt ist ohne Einfluss: gleiche Ecke und Außenpunkt, beliebiger Rest bleibt rund. */
assert.deepEqual(eckenFehler([DUNKEL.grund, DUNKEL.grund, DUNKEL.grund, DUNKEL.grund]), [])
console.log('ecken-urteil: ok (rund/eckig je Ecke, Schwelle 11/12, dunkel und hell)')
