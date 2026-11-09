/** Test des Filter-Messtor-Urteils (`filter-tempo-urteil.mjs`): feste Messwerte, je Grenze ein roter Fall. */
import assert from 'node:assert/strict'
import { urteil } from './filter-tempo-urteil.mjs'

const z = (reaktion, maximum) => ({ chip: 'TV', reaktion, maximum })

assert.equal(urteil([], 200, 800).ok, false, 'ohne Messung rot')
assert.equal(urteil([z(100, 150)], 200, 800).ok, true, 'schnell: grün')
assert.equal(urteil([z(200, 800)], 200, 800).ok, true, 'genau auf den Grenzen: grün')
assert.equal(urteil([z(201, 300)], 200, 800).ok, false, 'Median 1 ms drüber: rot')
assert.equal(urteil([z(100, 801)], 200, 800).ok, false, 'Spitze 1 ms drüber: rot')
assert.equal(urteil([z(100, 3856)], 200, 800).ok, false, 'der Fehler vom 05.11.2026 (ein Tipp 3,8 s bei Median 100): rot')
assert.equal(urteil([z(80, 90), z(288, 300)], 200, 800).ok, false, 'der größte Median zählt, nicht der erste')
assert.equal(urteil([z(80, 90), z(100, 5000)], 200).ok, true, 'ohne Spitzengrenze zählt nur der Median')
assert.equal(urteil([z(900, 5000)]).ok, true, 'ohne Grenze nur Anzeige')
assert.match(urteil([z(100, 150)], 200, 800).zeile, /^filter-tempo: ✓ .* langsamster Tipp 150 ms, Grenze 800 ms, 1 Chips$/)
console.log('filter-tempo-urteil: 10 Fälle ✓')
