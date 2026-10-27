/**
 * Test der Ermittlung „Welche Filter verstecken den exakten Treffer?“ (`web/src/lib/suchhinweis-filter.ts`).
 * `passt` ist hier eine feste Regel auf einem Mini-Titel (Jahr, Genre, bestätigt), kein Aufruf der App-Filter.
 */
import assert from 'node:assert/strict'
import { EMPTY_FILTERS, type FilterState } from '../web/src/lib/filters.ts'
import { blockadeText, zusatzText } from '../web/src/lib/suchhinweis-zaehlen.ts'
import { aktiveEinheiten, findeBlockade, loeseBlockade, SCHALTER, type Kandidat } from '../web/src/lib/suchhinweis-filter.ts'

interface Mini {
  name: string
  jahr: number
  genre: string
  sicher: boolean
}
const passt = (t: Mini, f: FilterState): boolean =>
  (!f.years.length || f.years.includes(t.jahr)) &&
  (!f.genres.length || f.genres.includes(t.genre)) &&
  !f.excluded.genres.includes(t.genre) &&
  (!f.confirmedOnly || t.sicher)
const mit = (patch: Partial<FilterState>): FilterState => ({ ...EMPTY_FILTERS, ...patch })
const ippo: Mini = { name: 'Ippo', jahr: 2000, genre: 'Sport', sicher: true }
const kand = (titel: Mini, nurMitSchalter = false): Kandidat<Mini> => ({ titel, nurMitSchalter })
const ids = (b: ReturnType<typeof findeBlockade<Mini>>): string[] => (b?.einheiten ?? []).map((e) => e.id)

// Nichts gesetzt, kein Kandidat: nichts zu lösen.
assert.equal(findeBlockade([kand(ippo)], EMPTY_FILTERS, false, passt), undefined)
assert.equal(findeBlockade([], mit({ years: [2003] }), false, passt), undefined)

// Ein Jahresfilter versteckt den Treffer: genau er, der Schalter „bestätigt“ (Titel ist bestätigt) bleibt unberührt.
const jahr = mit({ years: [2003], confirmedOnly: true })
const b1 = findeBlockade([kand(ippo)], jahr, true, passt)
assert.deepEqual(ids(b1), ['liste:years'])
assert.equal(b1?.synchro, false)
const geloest = loeseBlockade(jahr, b1!)
assert.deepEqual(geloest.years, [])
assert.equal(geloest.confirmedOnly, true, 'ein Filter, der nicht stört, bleibt')
assert.equal(passt(ippo, geloest), true, 'nach dem Lösen erscheint der Treffer (0 statt 1 Treffer behoben)')
assert.deepEqual(jahr.years, [2003], 'der Ausgangsfilter bleibt unverändert')

// Zwei Blockierer: Jahr und „nur bestätigte“ bei einem unbestätigten Titel; das Genre passt und bleibt.
const unsicher: Mini = { ...ippo, sicher: false }
const zwei = mit({ years: [2003], confirmedOnly: true, genres: ['Sport'] })
const b2 = findeBlockade([kand(unsicher)], zwei, true, passt)
assert.deepEqual(ids(b2).sort(), ['liste:years', 'schalter:confirmedOnly'])
assert.deepEqual(loeseBlockade(zwei, b2!).genres, ['Sport'])
assert.equal(passt(unsicher, loeseBlockade(zwei, b2!)), true)

// Ausschluss-Liste zählt als eigene Einheit.
const aus = mit({ excluded: { ...EMPTY_FILTERS.excluded, genres: ['Sport'] } })
assert.deepEqual(ids(findeBlockade([kand(ippo)], aus, true, passt)), ['ausschluss:genres'])

// Synchro: nur über den Schalter erreichbar und Schalter aus → gehört zur Blockade, auch ohne weitere Filter.
const b3 = findeBlockade([kand(ippo, true)], EMPTY_FILTERS, false, passt)
assert.equal(b3?.synchro, true)
assert.deepEqual(ids(b3), [])
// Schalter an und nichts versteckt: der Treffer ist da.
assert.equal(findeBlockade([kand(ippo, true)], EMPTY_FILTERS, true, passt), undefined)
// Synchro und Jahr zugleich.
const b4 = findeBlockade([kand(ippo, true)], mit({ years: [2003] }), false, passt)
assert.equal(b4?.synchro, true)
assert.deepEqual(ids(b4), ['liste:years'])

// Mehrere exakte Treffer: der mit den wenigsten Hindernissen gewinnt, egal an welcher Stelle der Liste.
const zwoelf: Mini = { name: 'B', jahr: 1999, genre: 'Action', sicher: false }
const filter = mit({ years: [2003], confirmedOnly: true })
const nurJahrOffen = findeBlockade([kand(zwoelf), kand(ippo)], filter, true, passt)
assert.equal(nurJahrOffen?.titel, ippo, 'ippo ist bestätigt, nur das Jahr stört')
assert.equal(findeBlockade([kand(ippo), kand(zwoelf)], filter, true, passt)?.titel, ippo)
// Gleich viele Hindernisse: der erste der Liste gewinnt, in beiden Reihenfolgen.
const gleichauf: Mini = { name: 'C', jahr: 1999, genre: 'Sport', sicher: true }
assert.equal(findeBlockade([kand(ippo), kand(gleichauf)], mit({ years: [2003] }), true, passt)?.titel, ippo)
assert.equal(findeBlockade([kand(gleichauf), kand(ippo)], mit({ years: [2003] }), true, passt)?.titel, gleichauf)
// Ist ein exakter Treffer sichtbar, gibt es nichts zu lösen — auch wenn ein anderer versteckt ist.
const sichtbar: Mini = { ...ippo, jahr: 2003 }
assert.equal(findeBlockade([kand(ippo), kand(sichtbar)], mit({ years: [2003] }), true, passt), undefined)

// Greift nur das Zusammenspiel zweier Filter, löst die Blockade beide (Rückfall), damit der Treffer sicher erscheint.
const nurZusammen = (_t: Mini, f: FilterState): boolean => !(f.years.length && f.genres.length)
const b5 = findeBlockade([kand(ippo)], mit({ years: [1], genres: ['x'] }), true, nurZusammen)
assert.deepEqual(ids(b5).sort(), ['liste:years', 'liste:genres'].sort())
assert.equal(nurZusammen(ippo, loeseBlockade(mit({ years: [1], genres: ['x'] }), b5!)), true)

// Passt der Titel auch ohne jeden Filter nicht, ist nichts zu lösen.
assert.equal(findeBlockade([kand(ippo)], mit({ years: [2003] }), true, () => false), undefined)

// Alle Schalter und die Mindeststufe werden erkannt.
for (const feld of SCHALTER) assert.deepEqual(aktiveEinheiten(mit({ [feld]: true })).map((e) => e.id), [`schalter:${feld}`])
assert.deepEqual(aktiveEinheiten(mit({ minConfidence: 'high' })).map((e) => e.id), ['vertrauen'])
assert.equal(aktiveEinheiten(mit({ minConfidence: 'high' }))[0]!.entferne(mit({ minConfidence: 'high' })).minConfidence, EMPTY_FILTERS.minConfidence)
assert.deepEqual(aktiveEinheiten(EMPTY_FILTERS), [])
assert.deepEqual(aktiveEinheiten(mit({ search: 'x' })), [], 'die Suche zählt nicht als Filter')

// Texte: Zahl der Treffer ohne Synchro, exakte nur wenn vorhanden; Blockade mit Namen der Filter.
assert.equal(zusatzText({ gesamt: 6, genau: 1 }), '6 Treffer ohne Synchro, davon 1 exakt')
assert.equal(zusatzText({ gesamt: 1200, genau: 0 }), '1.200 Treffer ohne Synchro')
assert.equal(zusatzText({ gesamt: 3, genau: 2 }), '3 Treffer ohne Synchro, davon 2 exakt')
assert.equal(blockadeText('Hajime no Ippo', ['Jahr 2003', 'ohne deutsche Synchro']), '„Hajime no Ippo“ ist ausgeblendet durch: Jahr 2003, ohne deutsche Synchro')

console.log('suchhinweis-filter.test: ok (Blockierer genau, Lösen entfernt nur sie, Synchro, kleinste Gruppe, Rückfall, Texte)')
