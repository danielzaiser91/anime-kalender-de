/* Regel `einzelnAbweichungen`: feste Messwerte (offene Ebenen vorher, nach einer anderen Taste, nach Escape; Fokus am Auslöser). */
import assert from 'node:assert/strict'
import { einzelnAbweichungen } from './ansicht-escape-einzeln.mjs'

const gut = { vorher: 1, nachTaste: 1, nachher: 0, fokus: true }
const mit = (aendere) => einzelnAbweichungen('X', aendere({ ...gut }))

assert.deepEqual(einzelnAbweichungen('X', gut), [], 'sauberer Fall')
assert.deepEqual(mit((m) => ({ ...m, vorher: 0, nachTaste: 0 })), ['X: Fenster nicht aufgegangen'], 'nie grün durch Nichtstun')
assert.deepEqual(mit((m) => ({ ...m, nachTaste: 0 })), ['X: eine andere Taste als Escape schließt das Fenster'], 'andere Taste schließt')
assert.deepEqual(mit((m) => ({ ...m, nachher: 1 })), ['X: Escape schließt das Fenster nicht'], 'Escape wirkungslos')
assert.deepEqual(mit((m) => ({ ...m, fokus: false })), ['X: Fokus kehrt nach Escape nicht zum Auslöser zurück'], 'Fokus verloren')
assert.deepEqual(mit((m) => ({ ...m, nachher: 1, fokus: false })), ['X: Escape schließt das Fenster nicht', 'X: Fokus kehrt nach Escape nicht zum Auslöser zurück'], 'beides')
console.log('ansicht-escape-einzeln: ok (6 Fälle)')
