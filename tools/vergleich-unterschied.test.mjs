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

// Liste ohne Kennung: Ein vorn eingefügter Eintrag verschiebt die übrigen nicht (patchnotes.json).
const notizen = Array.from({ length: 30 }, (_, i) => ({ datum: `2026-10-${10 + (i % 3)}`, text: `Eintrag ${i}`, link: '#/x' }))
const mitNeuem = [{ datum: '2026-10-13', text: 'Neu' }, ...notizen]
const einfuegung = jsonUnterschiede(notizen, mitNeuem)
assert.equal(einfuegung.size, 1, 'nur der neue Eintrag, nicht jedes verschobene Feld')
assert.match([...einfuegung.values()][0].beispiel, /"datum":"2026-10-13"/)
// Nur umsortiert: Die Datei ist verschieden, also steht eine Zeile da (Befund zu PR 1145), ohne Kennung wie mit Kennung.
const umsortiert = jsonUnterschiede(notizen, [...notizen].reverse())
assert.deepEqual([...umsortiert.keys()], ['[] (nur Reihenfolge)'])
assert.deepEqual(beschreibeUnterschied('patchnotes.json', JSON.stringify(notizen), JSON.stringify([...notizen].reverse())), [
  '    1× [] (nur Reihenfolge)  (z. B. gleiche Elemente, andere Reihenfolge)',
])
assert.deepEqual([...jsonUnterschiede([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 1 }]).keys()], ['[] (nur Reihenfolge)'], 'auch mit Kennung')
assert.equal(jsonUnterschiede(notizen, structuredClone(notizen)).size, 0, 'gleiche Reihenfolge: keine Zeile')
// Gegenprobe: ein wirklich geänderter Eintrag bleibt sichtbar, gleiche Dubletten zählen einzeln.
const geaendertEintrag = notizen.map((e, i) => (i === 5 ? { ...e, text: 'anders' } : e))
assert.equal(jsonUnterschiede(notizen, geaendertEintrag).get('[].text').n, 1)
assert.equal(jsonUnterschiede([{ a: 1 }, { a: 1 }], [{ a: 1 }]).size, 1, 'eine Dublette weniger ist ein Unterschied')

const text = beschreibeUnterschied('_protokoll.txt', 'gleich\nnur alt\n', 'gleich\nnur neu\n')
assert.deepEqual(text, ['    - nur alt', '    + nur neu'])

// Kennungen tragen den Titelnamen (deutsch, sonst englisch, sonst Romaji); ohne Namen bleibt es die nackte Kennung.
const namenAlt = [
  { id: 2167, titleDe: 'Tokyo Revengers', titleEn: 'T', x: 1 },
  { id: 5, titleDe: '', titleEn: 'Only English', x: 1 },
  { id: 6, titleRomaji: 'Nur Romaji', x: 1 },
  { id: 7, x: 1 },
  { id: 8, titleDe: 'Weg' },
]
const namenNeu = namenAlt.slice(0, 4).map((e) => ({ ...e, x: 2 }))
namenNeu.push({ id: 9, titleDe: 'Neu' })
const namenAus = jsonUnterschiede(namenAlt, namenNeu)
assert.equal(namenAus.get('[].x').n, 4)
assert.match(namenAus.get('[].x').beispiel, /Kennung 2167 \(Tokyo Revengers\)$/)
assert.equal(namenAus.get('[] (entfallen)').beispiel, 'Kennung 8 (Weg)')
assert.equal(namenAus.get('[] (hinzugekommen)').beispiel, 'Kennung 9 (Neu)')
const beispielVon = (id) => {
  const e = namenAlt.find((t) => t.id === id)
  return jsonUnterschiede([e], [{ ...e, x: 2 }]).get('[].x').beispiel
}
assert.match(beispielVon(5), /Kennung 5 \(Only English\)$/, 'leerer deutscher Titel zählt nicht')
assert.match(beispielVon(6), /Kennung 6 \(Nur Romaji\)$/)
assert.match(beispielVon(7), /Kennung 7$/, 'ohne Namen nur die Kennung')

console.log('vergleich-unterschied: ok')
