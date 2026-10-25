/**
 * Test: `pfeilFehler()` aus panel-reihe-schalter.mjs meldet Pfeile ohne Überlauf und Überlauf ohne Pfeile, ohne Browser.
 * Aufruf: node tools/panel-reihe-schalter.test.mjs  (läuft über tests-alle)
 */
import assert from 'node:assert/strict'
import { pfeilFehler } from './panel-reihe-schalter.mjs'

const spur = (karten, ueberlaeuft, pfeile) => ({ karten, ueberlaeuft, pfeile })

assert.deepEqual(pfeilFehler([spur(5, true, 2), spur(1, false, 0)], 'x'), [], 'gesund')
assert.deepEqual(pfeilFehler([spur(1, false, 2)], 'Schalter aus'), ['Schalter aus: Spur 1 (1 Karten) läuft nicht über, zeigt aber 2 Pfeile'], 'Pfeile ohne Überlauf')
assert.deepEqual(pfeilFehler([spur(1, false, 0), spur(5, true, 0)], 'an'), ['an: Spur 2 (5 Karten) läuft über, zeigt aber keine Pfeile'], 'Überlauf ohne Pfeile')
assert.equal(pfeilFehler([spur(1, false, 1), spur(5, true, 0)], 'x').length, 2, 'beide Fehler zugleich')
console.log('panel-reihe-schalter.test: grün')
