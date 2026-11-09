/** Test des Urteils der Auge-Messung: feste Werte, je Grenze ein roter Fall. */
import assert from 'node:assert/strict'
import { urteil } from './bereich-auge-urteil.mjs'

const auge = (breite, hoehe, rechts = 340, bereich = 'Im Handel') => ({ bereich, flaeche: { breite, hoehe }, rechts })

assert.equal(urteil([], 360).ok, false, 'ohne Auge rot')
assert.equal(urteil([auge(44, 44)], 360).ok, true, 'genau 44 × 44: grün')
assert.equal(urteil([auge(43, 44)], 360).ok, false, 'Breite 43: rot')
assert.equal(urteil([auge(44, 43)], 360).ok, false, 'Höhe 43: rot')
assert.equal(urteil([auge(44, 44, 360)], 360).ok, true, 'rechte Kante genau am Rand: grün')
assert.equal(urteil([auge(44, 44, 361)], 360).ok, false, 'rechte Kante 1 px drüber: rot')
assert.equal(urteil([auge(44, 44), auge(20, 20, 340, 'Im Fernsehen')], 360).ok, false, 'ein schlechtes Auge von zwei: rot')
assert.match(urteil([auge(44, 44), auge(44, 44, 340, 'Im Fernsehen')], 360).zeile, /^bereich-auge: ✓ 2 Augen bei 360 px/)
assert.match(urteil([auge(20, 20)], 360).zeile, /Im Handel: Trefferfläche 20×20 px/)
console.log('bereich-auge-urteil: 9 Fälle ✓')
