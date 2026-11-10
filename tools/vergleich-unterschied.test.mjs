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

// ICS: erste abweichende Zeile samt UID des umgebenden VEVENT, nicht „END:VCALENDAR“.
const ics = (summary2) => ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:a-1', 'SUMMARY:Eins', 'END:VEVENT', 'BEGIN:VEVENT', 'UID:b-2', `SUMMARY:${summary2}`, 'DTSTART:20261110', 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n')
assert.deepEqual(beschreibeUnterschied('abo.ics', ics('Zwei'), ics('Zwei neu')), [
  '    erste Abweichung: Zeile 8, UID b-2 → b-2',
  '    - SUMMARY:Zwei',
  '    + SUMMARY:Zwei neu',
])
assert.deepEqual(beschreibeUnterschied('abo.ics', ics('Zwei'), ics('Zwei')), [], 'gleich: keine Zeile')

// Randfälle der UID-Suche (Prüfer R1, Mutanten): je Fall verschiedene UID alt/neu oder eine Stelle außerhalb eines VEVENT.
const zeilenIcs = (liste) => liste.join('\r\n') + '\r\n'
const kopf = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:a-1', 'SUMMARY:Eins', 'END:VEVENT', 'BEGIN:VEVENT', 'UID:b-2', 'SUMMARY:Zwei', 'END:VEVENT', 'END:VCALENDAR']
const mit = (aendere) => zeilenIcs(kopf.map(aendere))
const ab = (alt, neu) => beschreibeUnterschied('abo.ics', alt, neu)
// UID selbst ändert sich: links alt, rechts neu (Mutant `uidUm(b, i)` → `uidUm(a, i)`).
assert.equal(ab(zeilenIcs(kopf), mit((z) => (z === 'UID:b-2' ? 'UID:b-9' : z)))[0], '    erste Abweichung: Zeile 7, UID b-2 → b-9')
// Zeile 1 weicht ab (Mutant `let i = 0` → `1`); davor kein VEVENT, daher keine UID, obwohl später eine kommt.
assert.deepEqual(ab(zeilenIcs(kopf), mit((z) => (z === 'BEGIN:VCALENDAR' ? 'BEGIN:VCALENDAR2' : z))), ['    erste Abweichung: Zeile 1, UID — → —', '    - BEGIN:VCALENDAR', '    + BEGIN:VCALENDAR2'])
// Abweichung zwischen zwei VEVENT: keine UID, auch nicht die des vorigen Ereignisses.
const zwischen = [...kopf.slice(0, 5), 'X-ZWISCHEN:1', ...kopf.slice(5)]
assert.equal(ab(zeilenIcs(zwischen), zeilenIcs(zwischen.map((z) => z.replace('X-ZWISCHEN:1', 'X-ZWISCHEN:2'))))[0], '    erste Abweichung: Zeile 6, UID — → —')
// Abweichung auf der END-Zeile: gehört noch zum eigenen VEVENT, nicht zum folgenden (Mutanten `start <= i`, `start = i + 1`).
const endAb = zeilenIcs(kopf.map((z, i) => (i === 4 ? 'END:VEVENT ' : z)))
assert.equal(ab(zeilenIcs(kopf), endAb)[0], '    erste Abweichung: Zeile 5, UID a-1 → a-1')
// VEVENT ohne UID: weder die des Nachbarn noch ein Fehler.
const ohneUid = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'SUMMARY:Eins', 'END:VEVENT', 'BEGIN:VEVENT', 'UID:b-2', 'END:VEVENT', 'END:VCALENDAR']
assert.equal(ab(zeilenIcs(ohneUid), zeilenIcs(ohneUid.map((z) => (z === 'SUMMARY:Eins' ? 'SUMMARY:Eins!' : z))))[0], '    erste Abweichung: Zeile 3, UID — → —')

// Gefaltete Zeilen (RFC 5545) werden vor dem Vergleich entfaltet.
const gefaltet = zeilenIcs(['BEGIN:VEVENT', 'UID:f-1', 'SUMMARY:Ein sehr langer', ' Titel', 'END:VEVENT'])
const flach = zeilenIcs(['BEGIN:VEVENT', 'UID:f-1', 'SUMMARY:Ein sehr langerTitel', 'END:VEVENT'])
assert.deepEqual(ab(gefaltet, flach), ['    nur Zeilenenden (CRLF/LF) oder Faltung verschieden'], 'andere Faltung, gleicher Inhalt')
assert.deepEqual(ab(gefaltet, gefaltet.replace('Titel', 'Titel!')), ['    erste Abweichung: Zeile 3, UID f-1 → f-1', '    - SUMMARY:Ein sehr langerTitel', '    + SUMMARY:Ein sehr langerTitel!'], 'Änderung in der Fortsetzung zeigt die ganze Zeile')
assert.deepEqual(ab(zeilenIcs(['A', 'B']), zeilenIcs(['A', ' B'])), ['    erste Abweichung: Zeile 1, UID — → —', '    - A', '    + AB'], 'Fortsetzung hängt an der vorigen Zeile')
assert.deepEqual(ab('A\r\n\tB\r\n', 'AB\r\n'), ['    nur Zeilenenden (CRLF/LF) oder Faltung verschieden'], 'Tab setzt ebenfalls fort')
assert.deepEqual(ab(' X\r\n', 'Y\r\n'), ['    erste Abweichung: Zeile 1, UID — → —', '    -  X', '    + Y'], 'beginnt die Datei mit Fortsetzung, bleibt die Zeile erhalten')

// Nur Zeilenenden (CRLF gegen LF): die Datei ist verschieden, also sagt eine Zeile es.
assert.deepEqual(ab(zeilenIcs(kopf), zeilenIcs(kopf).replace(/\r\n/g, '\n')), ['    nur Zeilenenden (CRLF/LF) oder Faltung verschieden'])

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
