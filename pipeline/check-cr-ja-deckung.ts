/**
 * Zusicherung: Ein Crunchyroll-Ja kommt nur von dem Titel, den ein Beleg trägt, nicht von dessen Serienkennung (16.10.2026,
 * Dorohedoro: Der Slot „Season 2 (Deutsch)“ gab auch Staffel 1 und dem Special ein Ja).
 * 1. Bauphase `sammleBelege`: der Slot einer Staffel belegt in einer Serie mit Null-Block nur den Titel mit eigenem Termin, nicht die Geschwister.
 * 2. `crJaOhneDeckung`: erkennt ein Ja in einer Serie mit Null-Block, das kein Beleg trägt; Termin, Handbeleg und Block-Urteil decken es.
 * Den echten Bestand misst `check-cr-ja-deckung-bestand.ts` (check:bestand-liste).
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-cr-ja-deckung.ts`
 */
import type { Release, StreamLink, Title } from '../shared/types.ts'
import { sammleBelege } from './bau/09-1-belege.ts'
import { crBelegKennungen, type BelegQuellen } from './lib/cr-ja-belege.ts'
import { crJaOhneDeckung, serienkennungenMitNullBlock } from './lib/cr-ja-deckung.ts'
import type { CrDubData, CrSerie } from './lib/crunchyroll-dub.ts'
import type { CrunchyrollEntry } from './lib/crunchyroll.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const URL = 'https://www.crunchyroll.com/de/series/GTEST0001/beispiel'
const weg = (rest: Partial<StreamLink> = {}): StreamLink => ({ platform: 'crunchyroll', url: URL, ...rest }) as StreamLink
const titel = (id: number, streams: StreamLink[], episodes = 12): Title =>
  ({ id, titleRomaji: `Titel ${id}`, episodes, streams, keywords: [], genres: [] }) as unknown as Title

const termin = {
  slug: 'a',
  titleId: 1,
  name: 'A',
  platform: 'crunchyroll',
  releaseType: 'weekly',
  sources: ['https://www.crunchyroll.com/de/simulcastcalendar'],
  schedule: { firstEpisodeDate: '2026-01-05', time: '17:45', episodeCount: 12 },
} as unknown as Release

console.log('\ncrJaOhneDeckung')
const serie = (staffeln: Array<[number, number]>): CrSerie =>
  ({
    url: URL,
    seriesId: 'GTEST0001',
    katalog: 'de',
    deutschImAngebot: true,
    staffeln: staffeln.map(([deutsch, folgen]) => ({ deutsch, folgen })),
  }) as unknown as CrSerie
/** Serien ohne Null-Block vor und hinter der geprüften: Die Auswahl darf weder nur die erste noch nur die letzte Serie ansehen. */
const nachbar = (n: number): CrSerie =>
  ({
    url: `https://www.crunchyroll.com/de/series/GFREMD000${n}/x`,
    seriesId: `GFREMD000${n}`,
    katalog: 'de',
    deutschImAngebot: true,
    staffeln: [{ deutsch: 12, folgen: 12 }],
  }) as unknown as CrSerie
const daten = (staffeln: Array<[number, number]>, nachbarn = false): CrDubData =>
  ({ scrapedAt: '', serien: nachbarn ? [nachbar(1), serie(staffeln), nachbar(2)] : [serie(staffeln)] }) as unknown as CrDubData
const leer = new Set<number>()
const lauf = (staffeln: Array<[number, number]>, t: Title, termine = leer, belege = leer, nachbarn = false) =>
  crJaOhneDeckung({ titles: [t], mitTermin: termine, mitBeleg: belege, crDub: daten(staffeln, nachbarn) })
const quellen = (teil: Partial<BelegQuellen>): BelegQuellen => ({ handbelege: [], katalog: [], zuordnung: [], offene: {}, titel: [], ...teil })

// 12 Folgen passen zu keinem Block (13 und 11): kein Block-Urteil trägt das Ja
const ungedeckt = titel(7, [weg({ dub: true })])
const klein = titel(7, [weg({ dub: true })], 5) // 5 Folgen passen zu keinem Block
pruefe('Ja ohne Bereiche, Serie mit Null-Block, kein Beleg: gemeldet', lauf([[0, 13], [11, 11]], ungedeckt).length === 1)
pruefe('der eigene Termin deckt das Ja', lauf([[0, 13], [11, 11]], ungedeckt, new Set([7])).length === 0)
pruefe('ein Beleg aus Hand oder Katalog deckt das Ja', lauf([[0, 13], [11, 11]], ungedeckt, leer, new Set([7])).length === 0)
pruefe('ohne Null-Block greift die Regel nicht (Block 12 von 13 deutsch)', lauf([[12, 13], [11, 11]], klein).length === 0)
pruefe('ein leerer Block (0 von 0) ist kein Null-Block', lauf([[0, 0], [12, 13]], klein).length === 0)
pruefe('ohne Urteil (dub fehlt) gibt es nichts zu decken', lauf([[0, 13], [11, 11]], titel(7, [weg()])).length === 0)
pruefe('bei einem Nein gibt es nichts zu decken', lauf([[0, 13], [11, 11]], titel(7, [weg({ dub: false })])).length === 0)
const mitBereich = titel(7, [weg({ dub: true, dubRanges: [{ from: 1, to: 12, dub: true }] })])
pruefe('ein Ja mit Folgenbereichen ist gedeckt', lauf([[0, 13], [11, 11]], mitBereich).length === 0)
const vollDeutsch = titel(8, [weg({ dub: true })], 11)
pruefe('ein Block-Urteil deckt das Ja (11 Folgen = der vollständig deutsche Block)', lauf([[0, 13], [11, 11]], vollDeutsch).length === 0)

// Keine einzige deutsche Folge in der Serie: Das Block-Urteil lautet „nein“ und darf das Ja nicht decken
pruefe('ein Block-Urteil „nein“ deckt das Ja nicht', lauf([[0, 13], [0, 11]], ungedeckt).length === 1)

console.log('\nBeleg-Mengen des Bestandswächters (crBelegKennungen)')
const gedeckt = (teil: Partial<BelegQuellen>): boolean => crBelegKennungen(quellen(teil)).has(7)
pruefe('Handbeleg dub false deckt nicht', !gedeckt({ handbelege: [{ platform: 'crunchyroll', dub: false, anilistId: 7 }] }))
pruefe('Handbeleg einer anderen Plattform deckt nicht', !gedeckt({ handbelege: [{ platform: 'netflix', dub: true, anilistId: 7 }] }))
pruefe('Handbeleg „deutsch“ auf Crunchyroll deckt', gedeckt({ handbelege: [{ platform: 'crunchyroll', dub: true, anilistId: 7 }] }))
pruefe('Katalogtreffer ohne de-DE deckt nicht', !gedeckt({ katalog: [{ id: 7, treffer: { audio: ['ja-JP'] } }] }))
pruefe('Katalogtreffer mit de-DE deckt', gedeckt({ katalog: [{ id: 7, treffer: { audio: ['ja-JP', 'de-DE'] } }] }))
pruefe('Zuordnung ohne de-DE deckt nicht', !gedeckt({ zuordnung: [{ id: 7, audio: ['ja-JP'] }] }))
pruefe('Zuordnung mit de-DE deckt', gedeckt({ zuordnung: [{ id: 7, audio: ['de-DE'] }] }))
pruefe('offener Befund ohne dub deckt nicht', !gedeckt({ offene: { [URL]: {} }, titel: [ungedeckt] }))
pruefe('offener Befund mit dub false deckt nicht', !gedeckt({ offene: { [URL]: { dub: false } }, titel: [ungedeckt] }))
const nurNetflix = titel(7, [{ platform: 'netflix', url: URL } as StreamLink])
pruefe('offener Befund an einer Adresse einer anderen Plattform deckt nicht', !gedeckt({ offene: { [URL]: { dub: true } }, titel: [nurNetflix] }))
pruefe('offener Befund mit dub true deckt', gedeckt({ offene: { [URL]: { dub: true } }, titel: [ungedeckt] }))

console.log('\nmehrere Serien, Null-Block nicht an erster Stelle')
pruefe('Null-Block als zweiter Block derselben Serie wird erkannt', lauf([[11, 11], [0, 13]], ungedeckt).length === 1)
pruefe('Null-Block als zweiter Block, Serie zwischen anderen: gemeldet', lauf([[11, 11], [0, 13], [10, 10]], ungedeckt, leer, leer, true).length === 1)
const kennungen = serienkennungenMitNullBlock(daten([[11, 11], [0, 13], [10, 10]], true))
pruefe('nur die Serie mit Null-Block (in der Mitte) steht in der Kennungsmenge', kennungen.size === 1 && kennungen.has('GTEST0001'), [...kennungen])
const zweiteNull = { ...serie([[0, 13], [11, 11]]), seriesId: 'GTEST0002', url: URL.replace('GTEST0001', 'GTEST0002') }
const beide = serienkennungenMitNullBlock({ scrapedAt: '', serien: [serie([[0, 13]]), zweiteNull] } as unknown as CrDubData)
pruefe('mehrere Serien mit Null-Block stehen alle in der Kennungsmenge', beide.size === 2, [...beide])

console.log('\nBauphase sammleBelege: Slot der Staffel, Geschwister an derselben Serienadresse')
/** Baut mit einem Kalender-Slot für Titel 1 und liefert (Titel mit Termin, Geschwister ohne Termin). */
function slotLauf(staffeln: Array<[number, number]>, slotKennung = 'GTEST0001', nachbarn = false): [Title, Title] {
  const mitTermin = titel(1, [weg()])
  const geschwister = titel(2, [weg()])
  sammleBelege({
    releases: [termin],
    titles: new Map([mitTermin, geschwister].map((t) => [t.id, t])),
    crBySeriesId: new Map([[slotKennung, {} as CrunchyrollEntry]]),
    tmdbMehrdeutig: new Set(),
    tmdbTitles: {},
    tvJeTmdb: new Set(),
    toteAdressen: new Set(),
    crDub: daten(staffeln, nachbarn),
  })
  return [mitTermin, geschwister]
}
const [mitSlot, ohneSlot] = slotLauf([[0, 13], [11, 11]])
pruefe('Null-Block: der Titel mit eigenem Termin bekommt das Ja', mitSlot.streams[0]!.dub === true, mitSlot.streams[0])
pruefe('Null-Block: das Geschwister ohne Termin bekommt kein Ja', ohneSlot.streams[0]!.dub === undefined, ohneSlot.streams[0])
const [, vollDeutschSlot] = slotLauf([[12, 12], [11, 11]])
pruefe('ohne Null-Block gilt der Slot der ganzen Serie (Slime S3, Mushoku S2)', vollDeutschSlot.streams[0]!.dub === true, vollDeutschSlot.streams[0])
const [, leererBlock] = slotLauf([[0, 0], [12, 13]])
pruefe('ein leerer Block (0 von 0) sperrt den Slot nicht', leererBlock.streams[0]!.dub === true, leererBlock.streams[0])
const [, fremdeKennung] = slotLauf([[12, 12], [11, 11]], 'GANDERE')
const [, mitteSerie] = slotLauf([[11, 11], [0, 13], [10, 10]], 'GTEST0001', true)
pruefe('Null-Block-Serie in der Mitte mehrerer Serien: Geschwister ohne Termin bekommt kein Ja', mitteSerie.streams[0]!.dub === undefined, mitteSerie.streams[0])
pruefe('ein Slot einer anderen Serie belegt nichts', fremdeKennung.streams[0]!.dub === undefined, fremdeKennung.streams[0])

if (verletzt) process.exit(1)
console.log('✓ Crunchyroll-Ja ist an Beleg gebunden.')
