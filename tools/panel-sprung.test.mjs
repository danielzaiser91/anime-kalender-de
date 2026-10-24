/**
 * Test: `unterschiede()` aus panel-sprung.mjs meldet jede Veränderung der Seite beim Öffnen des Panels, ohne Browser.
 * Aufruf: node tools/panel-sprung.test.mjs  (läuft in check:workflows)
 */
import assert from 'node:assert/strict'
import { unterschiede } from './panel-sprung.mjs'

const messung = (breite, kacheln) => ({ breite, leiste: 10, kacheln })
const KACHELN = [[0, 0, 100, 50], [110, 0, 100, 50], [220, 0, 100, 50]]
const vorher = messung(1270, KACHELN)

assert.deepEqual(unterschiede(vorher, messung(1270, KACHELN.map((k) => [...k])), 'x'), [], 'gleiche Messung')
assert.equal(unterschiede(vorher, messung(1280, KACHELN), 'x').length, 1, 'andere Breite')
assert.match(unterschiede(vorher, messung(1280, KACHELN), 'offen')[0], /^offen: Breite 1270 → 1280 px$/)
const verschoben = [KACHELN[0], [115, 0, 100, 50], KACHELN[2]]
assert.match(unterschiede(vorher, messung(1270, verschoben), 'x')[0], /1 von 3 Kacheln/, 'eine Kachel verschoben')
assert.match(unterschiede(vorher, messung(1270, KACHELN.slice(0, 2)), 'x')[0], /1 von 3 Kacheln/, 'weniger Kacheln')
assert.equal(unterschiede(vorher, messung(1280, verschoben), 'x').length, 2, 'Breite und Kachel zugleich')
console.log('panel-sprung.test: grün')
