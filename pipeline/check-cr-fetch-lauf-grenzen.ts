// Grenz- und Zweigfälle der CR-Lauf-Libs: je ein Datenfall pro Schwelle, ?:-Kette und Richtung
// (Auflagen A2 aus PR 2931), ergänzt `check-cr-fetch-lauf.ts` (alt gegen neu).
import assert from 'node:assert/strict'
import { trefferInAntwort } from './lib/cr-einzelwerke-lauf.ts'
import { blockTreffer, folgenTreffer } from './lib/cr-filmbloecke-lauf.ts'
import { katalogEintrag, ordneZu } from './lib/cr-katalog-lauf.ts'

type L = Record<string, any>

// --- trefferInAntwort: Gruppentyp schlägt Item-Typ, Metadaten-Kette
const gruppe = (type: string, item: L): L => ({ data: [{ type, items: [item] }] })
const g1 = trefferInAntwort(gruppe('movie_listing', { id: 'G', type: 'series', title: 'Ride Your Wave' }), ['Ride Your Wave'])!
assert.equal(g1.typ, 'movie_listing', 'Gruppentyp vor Item-Typ')
assert.equal(g1.art, 'series')
const g2 = trefferInAntwort(gruppe('x', { id: 'G', title: 'Ride Your Wave', movie_metadata: { audio_locale: 'de-DE' } }), ['Ride Your Wave'])!
assert.deepStrictEqual(g2.meta, { audio_locale: 'de-DE' }, 'nur movie_metadata')
const g3 = trefferInAntwort(gruppe('x', { id: 'G', title: 'Ride Your Wave', series_metadata: { a: 1 }, movie_metadata: { a: 2 } }), ['Ride Your Wave'])!
assert.deepStrictEqual(g3.meta, { a: 1 }, 'series_metadata vor movie_metadata')
const g4 = trefferInAntwort(gruppe('x', { id: 'G', title: 'Ride Your Wave', movie_listing_metadata: { a: 0 }, series_metadata: { a: 1 } }), ['Ride Your Wave'])!
assert.deepStrictEqual(g4.meta, { a: 0 }, 'movie_listing_metadata zuerst')
const g5 = trefferInAntwort(gruppe('x', { id: 'G', title: 'Ride Your Wave' }), ['Ride Your Wave'])!
assert.deepStrictEqual(g5.meta, {}, 'ohne Metadaten leer')

// --- blockTreffer: Kennwort mindestens sechs Zeichen
const block = (titel: string): L[] => [{ id: 'b', titel, audio: ['de-DE'] }]
assert.equal(blockTreffer('S', block('Reihe Abcde Teil'), ['Film - Abcde']), null, 'fünf Zeichen reichen nicht')
assert.equal(blockTreffer('S', block('Reihe Abcdef Teil'), ['Film - Abcdef'])?.blockId, 'b', 'sechs Zeichen reichen')

// --- folgenTreffer: Kennwort >= 6, beide Richtungen des Reihennamens
const folge = (titel: string, serie: string): L => ({ id: 'e', title: titel, episode_metadata: { series_title: serie, series_id: 'R', versions: [{ audio_locale: 'de-DE' }] } })
assert.equal(folgenTreffer([folge('Abcde', 'Reihe X')], 'Reihe X', ['Film - Abcde']), null, 'Kennwort mit fünf Zeichen')
assert.equal(folgenTreffer([folge('Abcdef', 'Reihe X')], 'Reihe X', ['Film - Abcdef'])?.blockId, 'e', 'Kennwort mit sechs Zeichen')
assert.equal(folgenTreffer([folge('Abcdef', 'Tonikawa')], 'Tonikawa Over', ['Film - Abcdef'])?.blockId, 'e', 'Serientitel kürzer als Reihe')
assert.equal(folgenTreffer([folge('Abcdef', 'Tonikawa Over')], 'Tonikawa', ['Film - Abcdef'])?.blockId, 'e', 'Serientitel länger als Reihe')
assert.equal(folgenTreffer([folge('Abcdef', 'Andere')], 'Tonikawa', ['Film - Abcdef']), null, 'fremde Serie')

// --- ordneZu
const katalog: L[] = [
  { id: 'k2', titel: 'Ride Your Wave', audio: [], folgen: 0 },
  { id: 'kA', titel: 'Abcde', audio: [], folgen: 5 },
  { id: 'kB', titel: 'Abcdef', audio: [], folgen: 4 },
  { id: 'kKurz', titel: 'Kurz', audio: [], folgen: 3 },
  { id: 'kT', titel: 'Zeta Omeg', audio: [], folgen: 7 },
  { id: 'kX', titel: 'Zeta Omega', audio: [], folgen: 7 },
]
const offen: L[] = [
  { id: 11, titel: 'Ride Your Wave', format: 'MOVIE', folgen: null },
  { id: 12, titel: 'Ride Your Wave', format: 'OVA', folgen: 1 },
  { id: 13, titel: 'Kurz Film', format: 'ONA', folgen: 3 },
  { id: 14, titel: 'Der Abcdef Film', format: 'ONA', folgen: 4 },
  { id: 15, titel: 'Der Abcde Film', format: 'ONA', folgen: 5 },
  { id: 16, titel: 'Zeta Omega', format: 'ONA', folgen: 7 },
  { id: 17, titel: 'Ride Your Wave', format: 'MOVIE', folgen: 1 },
]
const zu = ordneZu(offen, katalog)
const kat = (id: number) => zu.find((x) => x.id === id)?.katalogId
assert.equal(kat(11), undefined, 'MOVIE ohne Folgenzahl 1 trifft keinen 0-Folgen-Film')
assert.equal(kat(12), undefined, 'nur MOVIE bekommt die 0/1-Ausnahme')
assert.equal(kat(13), undefined, 'Katalogtitel mit vier Zeichen steckt nicht')
assert.equal(kat(14), 'kB', 'Katalogtitel mit sechs Zeichen steckt')
assert.equal(kat(15), undefined, 'Katalogtitel mit fünf Zeichen steckt nicht')
assert.equal(kat(16), 'kX', 'exakt schlägt Teiltreffer')
assert.equal(kat(17), 'k2', 'MOVIE mit einer Folge trifft Katalog mit 0 Folgen')

// --- katalogEintrag: Jahr aus Serienstart vor Filmjahr
const beide = { series_launch_year: 2001, movie_release_year: 2019 }
assert.equal(katalogEintrag({ id: 'F', title: 'F', movie_listing_metadata: beide }, 'movie_listing').jahr, 2001)
assert.equal(katalogEintrag({ id: 'F', title: 'F', series_metadata: beide }, '').jahr, 2001)
assert.equal(katalogEintrag({ id: 'F', title: 'F', series_metadata: { movie_release_year: 2019 } }, '').jahr, 2019)

console.log('✔ check-cr-fetch-lauf-grenzen: Schwellen, ?:-Ketten und Zweige der drei CR-Libs')
