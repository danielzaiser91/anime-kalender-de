/**
 * Zusicherungen zu „Zuletzt im Kino: April 2026“ (TMDB `release_dates`, Land DE, Typ 2/3): Abruf, Bau, Anzeige.
 * Aufruf: `npm run check:logic`.
 */
import { kinoFehlt, kinostartsDe, zuletztImKino, type ReleaseDatesAntwort } from './lib/tmdb-kino-zuletzt.ts'
import { kinoZuletztVon } from './bau/kino-zuletzt.ts'
import { streicheAbgelaufenes } from './lib/tmdb-ablauf.ts'
import { uebersetzeDatei } from './lib/ausgabe-kennung.ts'
import { fragtKinoZuletzt, kinoMonatText } from '../web/src/components/detail/kino-zuletzt.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const zeile = (type: number, tag: string) => ({ type, release_date: `${tag}T00:00:00.000Z` })
const antwort = (land: string, ...zeilen: ReturnType<typeof zeile>[]): ReleaseDatesAntwort => ({
  results: [{ iso_3166_1: land, release_dates: zeilen }],
})

console.log('\nKinostarts aus release_dates')
pruefe('Our Time: Typ 3 am 2026-04-25', kinostartsDe(antwort('DE', zeile(3, '2026-04-25'))).join() === '2026-04-25')
pruefe('Typ 2 (begrenzt) zählt', kinostartsDe(antwort('DE', zeile(2, '2020-06-30'))).join() === '2020-06-30')
pruefe('Gegenfall kein Eintrag: leer', kinostartsDe({}).length === 0 && kinostartsDe({ results: [] }).length === 0)
pruefe('Gegenfall anderes Land: leer', kinostartsDe(antwort('US', zeile(3, '2026-04-25'))).length === 0)
pruefe('Gegenfall Typ 4 (digital) und 5 (physisch): leer', kinostartsDe(antwort('DE', zeile(4, '2026-05-20'), zeile(5, '2026-06-20'))).length === 0)
pruefe('Gegenfall Typ 1 (Premiere) und 6 (Fernsehen): leer', kinostartsDe(antwort('DE', zeile(1, '2026-04-01'), zeile(6, '2026-08-01'))).length === 0)
pruefe('Kino und Disc gemischt: nur das Kino', kinostartsDe(antwort('DE', zeile(5, '2021-04-02'), zeile(2, '2020-06-30'))).join() === '2020-06-30')
pruefe('aufsteigend und ohne Doppelte', kinostartsDe(antwort('DE', zeile(3, '2026-04-25'), zeile(3, '2025-01-02'), zeile(2, '2026-04-25'))).join() === '2025-01-02,2026-04-25')
pruefe('Eintrag ohne Datum fällt weg', kinostartsDe({ results: [{ iso_3166_1: 'DE', release_dates: [{ type: 3 }] }] }).length === 0)

console.log('\nJüngster Kinostart bis heute, nur der Monat')
pruefe('April 2026', zuletztImKino(['2026-04-25'], '2026-10-13') === '2026-04')
pruefe('Gegenfall Start in der Zukunft: nichts', zuletztImKino(['2026-11-05'], '2026-10-13') === undefined)
pruefe('Gegenfall kein Start: nichts', zuletztImKino([], '2026-10-13') === undefined && zuletztImKino(undefined, '2026-10-13') === undefined)
pruefe('vergangen und künftig: der vergangene', zuletztImKino(['2026-04-25', '2026-11-05'], '2026-10-13') === '2026-04')
pruefe('mehrere vergangene: der jüngste', zuletztImKino(['2003-08-01', '2026-08-18'], '2026-10-13') === '2026-08')
pruefe('der Starttag zählt als heute', zuletztImKino(['2026-10-13'], '2026-10-13') === '2026-10')
pruefe('Frist: ein künftiger Start erscheint am Starttag, nicht vorher', zuletztImKino(['2026-10-20'], '2026-10-19') === undefined && zuletztImKino(['2026-10-20'], '2026-10-20') === '2026-10')
pruefe('kein Tag im Ergebnis', !/-\d\d-\d\d/.test(zuletztImKino(['2026-04-25'], '2026-10-13') ?? ''))

console.log('\nBau: Datei kino-zuletzt.json')
const filme = [
  { id: 1, format: 'MOVIE' },
  { id: 2, format: 'MOVIE' },
  { id: 3, format: 'TV' },
  { id: 4, format: 'MOVIE' },
  { id: 5, format: 'MOVIE' },
]
const tmdb = {
  1: { kind: 'movie' as const, kinoDe: ['2026-04-25'] },
  2: { kind: 'movie' as const, kinoDe: [] },
  3: { kind: 'movie' as const, kinoDe: ['2026-04-25'] },
  4: { kind: 'tv' as const, kinoDe: ['2026-04-25'] },
}
const monate = kinoZuletztVon(filme, tmdb, '2026-10-13')
pruefe('Film mit Start: Monat', monate[1] === '2026-04', monate)
pruefe('Gegenfall Film ohne Start, ohne TMDB-Eintrag, TV-Format, TV-Kennung: kein Eintrag', Object.keys(monate).join() === '1', monate)
pruefe('Kennungen werden in die Ausgabe-Kennung übersetzt', JSON.stringify(uebersetzeDatei('kino-zuletzt.json', { 1: '2026-04' }, (id) => id + 1000)) === '{"1001":"2026-04"}')

console.log('\nAbruf: Frist und Ablauf')
pruefe('Film ohne gespeicherte Kinostarts ist sofort fällig (auch frisch geholt)', kinoFehlt({ tmdbId: 7, kind: 'movie' }))
pruefe('Film mit leerer Liste ist erledigt', !kinoFehlt({ tmdbId: 7, kind: 'movie', kinoDe: [] }))
pruefe('Serien und Treffer ohne Kennung warten nicht auf Kinostarts', !kinoFehlt({ tmdbId: 7, kind: 'tv' }) && !kinoFehlt({ kind: 'movie' }))
const alt = { tmdbId: 7, kind: 'movie', fetchedAt: '2026-01-01T00:00:00Z', inhaltAm: '2026-01-01T00:00:00Z', kinoDe: ['2026-04-25'] }
streicheAbgelaufenes({ alt }, new Date('2026-10-13T00:00:00Z'))
pruefe('TMDB-Inhalt verfällt nach 150 Tagen, auch die Kinostarts', alt.kinoDe === undefined)

console.log('\nAnzeige')
const film = { art: 'film' as const, hatSynchro: true, raus: 1, gesamt: 1, ohneWeg: true, imKino: false }
pruefe('Monat und Jahr', kinoMonatText('2026-04') === 'April 2026' && kinoMonatText('2003-08') === 'August 2003')
pruefe('Film mit belegter Synchro: gefragt', fragtKinoZuletzt(film))
pruefe('Gegenfall Film ohne belegte Synchro: nicht gefragt (Kinostart sagt nichts über die Fassung)', !fragtKinoZuletzt({ ...film, hatSynchro: false }))
pruefe('Gegenfall Kino-Banner läuft: nicht gefragt', !fragtKinoZuletzt({ ...film, imKino: true }))
pruefe('Gegenfall Serie, angekündigter Kinofilm, Film mit DE-Termin: nicht gefragt', !fragtKinoZuletzt({ art: 'ohne' } as never) && !fragtKinoZuletzt({ art: 'kino' } as never) && !fragtKinoZuletzt({ art: 'filmDe' } as never))

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nZuletzt im Kino: alle Zusicherungen halten.')
