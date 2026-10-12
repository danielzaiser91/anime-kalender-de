// Prüft, dass der Vergleich Felder nach Kennung zuordnet und die Herkunft eines Häkchens (`dubQuelle`) sichtbar macht.
import assert from 'node:assert/strict'
import { beschreibeUnterschied, jsonUnterschiede } from './vergleich-unterschied.mjs'

const alt = [
  { id: 1, titel: 'A', streams: [{ platform: 'primevideo', dub: true }] },
  { id: 2, titel: 'B', streams: [{ platform: 'primevideo' }] },
  { id: 3, titel: 'C' },
]
const neu = [
  { id: 2, titel: 'B', streams: [{ platform: 'primevideo', dubQuelle: 'justwatch', dubStand: '2026-10-11' }] },
  { id: 1, titel: 'A', streams: [{ platform: 'primevideo', dub: true }] },
  { id: 4, titel: 'D' },
]

const aus = jsonUnterschiede(alt, neu)
assert.equal(aus.get('[].streams[].dubQuelle').n, 1)
assert.match(aus.get('[].streams[].dubQuelle').beispiel, /"justwatch".*Kennung 2/)
assert.equal(aus.get('[].streams[].dubStand').n, 1)
assert.equal(aus.get('[] (entfallen)').beispiel, 'Kennung 3')
assert.equal(aus.get('[] (hinzugekommen)').beispiel, 'Kennung 4')
assert.equal(aus.has('[].titel'), false, 'Reihenfolge allein ist kein Unterschied')

assert.equal(jsonUnterschiede(alt, structuredClone(alt)).size, 0)

const zeilen = beschreibeUnterschied('titles.json', JSON.stringify(alt), JSON.stringify(neu))
assert.ok(zeilen.some((z) => z.includes('streams[].dubQuelle')))

const text = beschreibeUnterschied('_protokoll.txt', 'gleich\nnur alt\n', 'gleich\nnur neu\n')
assert.deepEqual(text, ['    - nur alt', '    + nur neu'])

console.log('vergleich-unterschied: ok')
