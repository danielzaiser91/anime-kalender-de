/**
 * Zusicherungen zur Synchro-Fortschreibung nach den Originalterminen (15.10.2026, Tomb Raider King):
 * Folgt die deutsche Fassung dem Original in stabilem Abstand (mindestens vier Folgen, Streuung höchstens ein Tag),
 * liegt eine offene Folge auf Originaltag plus Abstand — sonst bleibt die Wochenfortschreibung.
 * Läuft in `check:logic`.
 */
import type { Release, Title } from '../shared/types.ts'
import { expandEvents, lastEpisodeDate, releaseStatus } from '../shared/logic.ts'
import { addDays } from '../shared/time.ts'
import { folgeNachOriginal, synchroVersatz, termineNachOriginal } from '../shared/synchro-original.ts'
import { istStaffelfinale } from '../shared/tv-signale.ts'
import { translate } from '../web/src/lib/i18n.tsx'
import { laeuftNeben } from '../web/src/components/detail/antwort-block.ts'
import { berechneAntwort } from '../web/src/components/detail/antwort-berechnen.ts'
import { originalTage, schreibeNachOriginal } from './bau/synchro-nach-original.ts'
import { rolleTermineAusMitKomplettabwurf } from './bau/10-komplettabwurf.ts'
import type { rolleTermineAus } from './bau/10-termine.ts'

const T = translate as unknown as (k: string, v?: Record<string, string | number>) => string
let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

/** Folge n am Starttag plus `abstaende[n-1]` Tage. */
function tageAb(start: string, abstaende: number[]): Record<number, string> {
  return Object.fromEntries(abstaende.map((a, i) => [i + 1, addDays(start, a)]))
}

/* Tomb Raider King: Original wöchentlich, vor dem Finale eine Woche Pause; Synchro immer +20 Tage. */
const ORIGINAL = tageAb('2026-07-09', [0, 7, 14, 21, 28, 35, 42, 49, 56, 63, 70, 84])
const SYNCHRO = Object.fromEntries(Object.entries(ORIGINAL).slice(0, 11).map(([n, d]) => [n, addDays(d, 20)]))

pruefe('Abstand +20 über elf Folgen', synchroVersatz(SYNCHRO, ORIGINAL) === 20)
pruefe('drei Folgen genügen nicht', synchroVersatz({ 1: SYNCHRO[1], 2: SYNCHRO[2], 3: SYNCHRO[3] }, ORIGINAL) === undefined)
pruefe('vier Folgen genügen', synchroVersatz({ 1: SYNCHRO[1], 2: SYNCHRO[2], 3: SYNCHRO[3], 4: SYNCHRO[4] }, ORIGINAL) === 20)
pruefe('Streuung zwei Tage: kein Abstand', synchroVersatz({ ...SYNCHRO, 5: addDays(SYNCHRO[5], 2) }, ORIGINAL) === undefined)
pruefe('Streuung ein Tag: noch ein Abstand', synchroVersatz({ ...SYNCHRO, 5: addDays(SYNCHRO[5], 1) }, ORIGINAL) === 20)
const MEHRHEIT_21 = { 1: addDays(ORIGINAL[1], 20), 2: addDays(ORIGINAL[2], 21), 3: addDays(ORIGINAL[3], 21), 4: addDays(ORIGINAL[4], 21), 5: addDays(ORIGINAL[5], 21) }
pruefe('Streuung ein Tag: der mittlere Abstand zählt', synchroVersatz(MEHRHEIT_21, ORIGINAL) === 21)
pruefe('Folge ohne Originaltag zählt nicht mit', synchroVersatz({ 1: SYNCHRO[1], 2: SYNCHRO[2], 3: SYNCHRO[3], 99: '2026-12-01' }, ORIGINAL) === undefined)

const nach = termineNachOriginal(SYNCHRO, ORIGINAL, 12)
pruefe('Folge 12 nach Originalpause: 21.10.', nach[12] === '2026-10-21', JSON.stringify(nach))
pruefe('nur Folgen hinter der letzten Beobachtung', Object.keys(nach).join() === '12', Object.keys(nach).join())
pruefe('instabiler Abstand: leer', Object.keys(termineNachOriginal({ ...SYNCHRO, 3: addDays(SYNCHRO[3], 5) }, ORIGINAL, 12)).length === 0)
pruefe(
  'Tag nicht hinter der letzten Beobachtung: abgeschnitten',
  Object.keys(termineNachOriginal(SYNCHRO, { ...ORIGINAL, 12: ORIGINAL[11] }, 12)).length === 0,
)

const OHNE_PAUSE = { ...ORIGINAL, 12: addDays(ORIGINAL[11], 7) }
pruefe('Original ohne Pause (Wochentakt ergibt dasselbe): leer', Object.keys(termineNachOriginal(SYNCHRO, OHNE_PAUSE, 12)).length === 0)
pruefe('Original mit Pause: nur Folgen bis zur Folgenzahl des Releases', Object.keys(termineNachOriginal(SYNCHRO, { ...ORIGINAL, 13: addDays(ORIGINAL[12], 7) }, 12)).join() === '12')
const EINE_PAUSE_SPAETER = { ...OHNE_PAUSE, 13: addDays(OHNE_PAUSE[12], 14) }
pruefe('eine Folge im Wochentakt, eine nach Pause: die Tabelle beginnt bei der Pause', Object.keys(termineNachOriginal(SYNCHRO, EINE_PAUSE_SPAETER, 13)).join() === '13')
/* TMDB streut um einen Tag (Darling in the Franxx, Magic Maker …: 26 von 26 Mal stimmte der Wochentakt). */
const EIN_TAG_DANEBEN = { ...ORIGINAL, 12: addDays(ORIGINAL[11], 8) }
pruefe('ein Tag neben dem Wochentakt: leer', Object.keys(termineNachOriginal(SYNCHRO, EIN_TAG_DANEBEN, 12)).length === 0)
pruefe('ein Tag früher als der Wochentakt: leer', Object.keys(termineNachOriginal(SYNCHRO, { ...ORIGINAL, 12: addDays(ORIGINAL[11], 6) }, 12)).length === 0)
pruefe('zwei Tage früher als der Wochentakt: Tabelle', termineNachOriginal(SYNCHRO, { ...ORIGINAL, 12: addDays(ORIGINAL[11], 5) }, 12)[12] === addDays(ORIGINAL[11], 25))
const ZWEI_TAGE_DANEBEN = { ...ORIGINAL, 12: addDays(ORIGINAL[11], 9) }
pruefe('zwei Tage neben dem Wochentakt: Tabelle', termineNachOriginal(SYNCHRO, ZWEI_TAGE_DANEBEN, 12)[12] === addDays(ZWEI_TAGE_DANEBEN[12], 20))
pruefe('ein Tag daneben, danach Pause: nur die Pause zählt', Object.keys(termineNachOriginal(SYNCHRO, { ...EIN_TAG_DANEBEN, 13: addDays(EIN_TAG_DANEBEN[12], 14) }, 13)).join() === '13')
pruefe('Folge hinter der Folgenzahl des Releases: leer', Object.keys(termineNachOriginal(SYNCHRO, ORIGINAL, 11)).length === 0)
pruefe('Wochenabstand hinter der letzten bekannten Folge', folgeNachOriginal({ 12: '2026-10-21' }, 13, { episode: 11, date: '2026-10-07' }) === '2026-10-28')
pruefe('vor der ersten bekannten Folge: nichts', folgeNachOriginal({ 12: '2026-10-21' }, 11, { episode: 10, date: '2026-10-07' }) === undefined)
pruefe('kein Tag hinter dem Stützpunkt: nichts', folgeNachOriginal({ 12: '2026-10-21' }, 12, { episode: 11, date: '2026-10-21' }) === undefined)
pruefe('mehrere bekannte Folgen: die jeweils vorangehende zählt', folgeNachOriginal({ 12: '2026-10-21', 13: '2026-10-29' }, 13, { episode: 11, date: '2026-10-07' }) === '2026-10-29')
pruefe('ohne Stützpunkt: nichts', folgeNachOriginal({ 12: '2026-10-21' }, 12, undefined) === undefined)
pruefe('ohne Tabelle: nichts', folgeNachOriginal(undefined, 12, { episode: 11, date: '2026-10-07' }) === undefined)

function release(zusatz: Partial<Release['schedule']>): Release {
  return {
    slug: 'trk',
    titleId: 184356,
    name: 'Tomb Raider King',
    platform: 'crunchyroll',
    platformUrl: 'https://www.crunchyroll.com/de/series/GT00378123/tomb-raider-king',
    releaseType: 'weekly',
    schedule: { firstEpisodeDate: '2026-07-29', time: '19:25', episodeCount: 12, observed: SYNCHRO, ...zusatz },
    sources: [],
  } as unknown as Release
}
const folge12 = (r: Release) => expandEvents(r).find((e) => e.episode === 12)

pruefe('ohne Tabelle: Wochenfortschreibung 14.10.', folge12(release({}))?.date === '2026-10-14')
const mit = folge12(release({ nachOriginal: nach }))
pruefe('mit Tabelle: 21.10.', mit?.date === '2026-10-21', mit?.date)
pruefe('Ergebnis bleibt geschätzt', mit?.estimated === true)
pruefe('Tag nicht hinter dem Stützpunkt: Wochenfortschreibung', folge12(release({ nachOriginal: { 12: '2026-10-07' } }))?.date === '2026-10-14')
pruefe('belegte Folge schlägt die Tabelle', expandEvents(release({ nachOriginal: { 11: '2026-12-01' } })).find((e) => e.episode === 11)?.date === '2026-10-07')

pruefe('Ende der Reihe mit Tabelle: 21.10.', lastEpisodeDate(release({ nachOriginal: nach })) === '2026-10-21')
pruefe('Ende der Reihe ohne Tabelle: 14.10.', lastEpisodeDate(release({})) === '2026-10-14')
pruefe('am 15.10. läuft die Reihe noch', releaseStatus(release({ nachOriginal: nach }), '2026-10-15') === 'airing')
pruefe('Sendepause am Tabellentag: eine Woche später', lastEpisodeDate(release({ nachOriginal: nach, skipDates: ['2026-10-21'] })) === '2026-10-28')
pruefe('Sendepause am Wochentakt-Tag: Tabelle bleibt', lastEpisodeDate(release({ nachOriginal: nach, skipDates: ['2026-10-14'] })) === '2026-10-21')
pruefe('zwei Sendepausen hintereinander', lastEpisodeDate(release({ nachOriginal: nach, skipDates: ['2026-10-21', '2026-10-28'] })) === '2026-11-04')

/* Ausgeblieben am 14.10., errechnet am 21.10.: das Finale steht nur am 21.10. */
const mitVermerk = release({ nachOriginal: nach, verpasst: { 12: { erwartetAm: '2026-10-14T17:25:00.000Z' } } })
const finaleTage = expandEvents(mitVermerk).filter((e) => e.episode === 12 && istStaffelfinale(e, { releaseBySlug: new Map([[mitVermerk.slug, mitVermerk]]) })).map((e) => e.date)
pruefe('Staffelfinale nur am 21.10., nicht am ausgebliebenen 14.10.', finaleTage.join() === '2026-10-21', finaleTage.join())
pruefe('beide Tage der Folge 12 stehen im Kalender', expandEvents(mitVermerk).filter((e) => e.episode === 12).length === 2)
const neben = (r: Release) => {
  const a = berechneAntwort({ title: { id: 184356, format: 'TV', episodes: 12 } as unknown as Title, releases: [r], today: '2026-10-15', jetzt: new Date('2026-10-15T12:00:00Z') })
  return a?.art === 'laeuft' ? laeuftNeben(a, T) : undefined
}
pruefe('geschätzter Ersatztermin: „erwartet statt … (geschätzt)“', neben(mitVermerk)?.includes('erwartet statt 14.10.2026 (geschätzt)') === true, neben(mitVermerk))
const genannt = release({ observed: { ...SYNCHRO, 12: '2026-10-21' }, verpasst: { 12: { erwartetAm: '2026-10-14T17:25:00.000Z' } } })
pruefe('vom Anbieter genannter Ersatztermin: „verschoben vom …“', neben(genannt)?.includes('verschoben vom 14.10.') === true, neben(genannt))
const recherchiert = release({ verpasst: { 12: { erwartetAm: '2026-10-14T17:25:00.000Z', neuErwartet: '2026-10-22' } } })
pruefe('recherchierter Ersatztermin (neuErwartet): „verschoben vom …“', neben(recherchiert)?.includes('verschoben vom 14.10.') === true, neben(recherchiert))

const folgen = (s: number, daten: Record<number, string | null>) => Object.entries(daten).map(([e, datum]) => ({ s, e: Number(e), titel: null, datum }))
pruefe('eine Staffel: Originaltage', originalTage({ folgen: folgen(1, ORIGINAL) })[12] === ORIGINAL[12])
pruefe('Staffel 0 (Specials) zählt nicht', originalTage({ folgen: [...folgen(0, { 1: '2000-01-01' }), ...folgen(1, ORIGINAL)] })[12] === ORIGINAL[12])
pruefe('zwei Staffeln: keine Zuordnung', Object.keys(originalTage({ folgen: [...folgen(1, ORIGINAL), ...folgen(2, ORIGINAL)] })).length === 0)
pruefe('Folge ohne Datum fehlt', originalTage({ folgen: folgen(1, { 1: null, 2: '2026-07-16' }) })[1] === undefined)

const r1 = release({})
const r2 = release({ wochentage: [3] })
const r3 = { ...release({}), releaseType: 'single' } as unknown as Release
const r4 = release({ observed: { ...SYNCHRO, 5: addDays(SYNCHRO[5], 4) } })
const geschrieben = schreibeNachOriginal([r1, r2, r3, r4], { '184356': { tmdbId: 297826, folgen: folgen(1, ORIGINAL) } })
pruefe('geschrieben nur an das stabile wöchentliche Release', geschrieben === 1 && r1.schedule.nachOriginal?.[12] === '2026-10-21')
pruefe('feste Sendetage, Einzeltermin, instabil: nichts', !r2.schedule.nachOriginal && !r3.schedule.nachOriginal && !r4.schedule.nachOriginal)
pruefe('die TMDB-Seite steht als Grundlage am Termin, nicht in den sources', r1.schedule.nachOriginalQuelle === 'https://www.themoviedb.org/tv/297826' && r1.sources.length === 0)
const ohneKennung = release({})
schreibeNachOriginal([ohneKennung], { '184356': { folgen: folgen(1, ORIGINAL) } })
pruefe('ohne TMDB-Kennung keine Adresse', ohneKennung.schedule.nachOriginal?.[12] === '2026-10-21' && !ohneKennung.schedule.nachOriginalQuelle)
pruefe('Folgenzahl des Releases begrenzt die Tabelle', schreibeNachOriginal([release({ episodeCount: 11 })], { '184356': { folgen: folgen(1, ORIGINAL) } }) === 0)
pruefe('ohne TMDB-Eintrag: nichts', schreibeNachOriginal([release({})], {}) === 0)

/* Die Phase ruft es auf, bevor `rolleTermineAus` die Termine rechnet. */
const vorRolle = release({})
let gesehenInRolle: Record<number, string> | undefined
const rolle = ((args: { releases: Release[] }) => {
  gesehenInRolle = args.releases[0].schedule.nachOriginal
  return {}
}) as unknown as typeof rolleTermineAus
rolleTermineAusMitKomplettabwurf(
  { releases: [vorRolle], titles: new Map(), jpStart: new Map() },
  { rolle, handNein: () => new Set(), tmdb: { '184356': { folgen: folgen(1, ORIGINAL) } } },
)
pruefe('Phase 10 schreibt die Tabelle vor der Terminrechnung', gesehenInRolle?.[12] === '2026-10-21', JSON.stringify(gesehenInRolle))

if (fehler) process.exit(1)
console.log('check-synchro-original: ok')
