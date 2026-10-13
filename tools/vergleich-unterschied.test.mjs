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

// Ein Feld, das im neuen Stand fehlt, steht in der Ausgabe — auch wenn es nur einmal vorkommt und mehr als `max` häufigere Änderungen daneben stehen.
const viele = Array.from({ length: 20 }, (_, i) => ({ id: i, a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1, selten: 'x' }))
const geaendert = viele.map(({ selten, ...rest }, i) => ({ ...rest, a: 2, b: 2, c: 2, d: 2, e: 2, f: 2, g: 2, ...(i === 0 ? {} : { selten }) }))
const wegAus = jsonUnterschiede(viele, geaendert)
assert.equal(wegAus.get('[].selten (entfernt)').n, 1)
const wegZeilen = beschreibeUnterschied('titles.json', JSON.stringify(viele), JSON.stringify(geaendert))
assert.ok(wegZeilen[0].includes('[].selten (entfernt)'), 'entfernte Felder stehen vorn')
assert.ok(wegZeilen.some((z) => z.includes('weitere Felder')), 'die häufigen Änderungen sind trotzdem gekürzt')
assert.equal(jsonUnterschiede({ x: 1, y: null }, { x: 1 }).get('.y (entfernt)').n, 1, 'null → fehlt ist entfernt')

// Ein Listenelement mit Kennung, das im neuen Stand fehlt, steht ebenfalls vorn, auch hinter mehr als `max` häufigeren Änderungen.
const mitId = Array.from({ length: 20 }, (_, i) => ({ id: i, a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1 }))
const ohneEins = mitId.slice(1).map((e) => ({ ...e, a: 2, b: 2, c: 2, d: 2, e: 2, f: 2, g: 2 }))
const fehltZeilen = beschreibeUnterschied('titles.json', JSON.stringify(mitId), JSON.stringify(ohneEins))
assert.ok(fehltZeilen[0].includes('[] (entfallen)'), 'entfallene Listenelemente stehen vorn')
assert.ok(fehltZeilen.some((z) => z.includes('weitere Felder')), 'die häufigen Änderungen sind trotzdem gekürzt')

const text = beschreibeUnterschied('_protokoll.txt', 'gleich\nnur alt\n', 'gleich\nnur neu\n')
assert.deepEqual(text, ['    - nur alt', '    + nur neu'])

console.log('vergleich-unterschied: ok')
