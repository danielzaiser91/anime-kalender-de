/* Regel `stapelAbweichungen`: feste Zählungen (Anzahl offener Ebenen vor, nach dem ersten und nach dem zweiten Escape). */
import assert from 'node:assert/strict'
import { stapelAbweichungen } from './ansicht-escape-stapel.mjs'

const gut = { vorher: { oben: 1, panel: 1 }, nachEins: { oben: 0, panel: 1 }, nachZwei: { oben: 0, panel: 0 } }
const mit = (aendere) => {
  const m = structuredClone(gut)
  aendere(m)
  return stapelAbweichungen('X', m)
}

assert.deepEqual(stapelAbweichungen('X', gut), [], 'sauberer Stapel')
assert.deepEqual(mit((m) => (m.nachEins.panel = 0)), ['X: erster Escape schließt das Panel darunter mit'], 'Doppel-Schließung (der Anlassfall)')
assert.deepEqual(mit((m) => (m.nachEins.oben = 1)), ['X: erster Escape schließt die oberste Ebene nicht'], 'oberste Ebene bleibt')
assert.deepEqual(mit((m) => (m.nachZwei.panel = 1)), ['X: zweiter Escape schließt das Panel nicht'], 'Panel bleibt nach dem zweiten')
assert.deepEqual(mit((m) => ((m.nachEins.oben = 1), (m.nachEins.panel = 0))), ['X: erster Escape schließt die oberste Ebene nicht', 'X: erster Escape schließt das Panel darunter mit'], 'beides')
assert.deepEqual(mit((m) => (m.vorher.oben = 0)), ['X: Stapel nicht aufgebaut (oben 0, Panel 1)'], 'oben fehlt: nie grün durch Nichtstun')
assert.deepEqual(mit((m) => (m.vorher.panel = 0)), ['X: Stapel nicht aufgebaut (oben 1, Panel 0)'], 'Panel fehlt')
console.log('ansicht-escape-stapel: ok (7 Fälle)')
