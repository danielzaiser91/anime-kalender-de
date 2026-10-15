/**
 * Zusicherungen zur Synchro-Fortschreibung nach den Originalterminen (15.10.2026, Tomb Raider King):
 * Folgt die deutsche Fassung dem Original in stabilem Abstand (mindestens vier Folgen, Streuung höchstens ein Tag),
 * liegt eine offene Folge auf Originaltag plus Abstand — sonst bleibt die Wochenfortschreibung.
 * Läuft in `check:logic`.
 */
import type { Release } from '../shared/types.ts'
import { expandEvents, lastEpisodeDate, releaseStatus } from '../shared/logic.ts'
import { addDays } from '../shared/time.ts'
import { folgeNachOriginal, synchroVersatz, termineNachOriginal } from '../shared/synchro-original.ts'
import { originalTage, schreibeNachOriginal } from './bau/synchro-nach-original.ts'
import { rolleTermineAusMitKomplettabwurf } from './bau/10-komplettabwurf.ts'
import type { rolleTermineAus } from './bau/10-termine.ts'

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
pruefe('eine Folge im Wochentakt, eine nach Pause: Tabelle bleibt', Object.keys(termineNachOriginal(SYNCHRO, EINE_PAUSE_SPAETER, 13)).join() === '12,13')
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

const folgen = (s: number, daten: Record<number, string | null>) => Object.entries(daten).map(([e, datum]) => ({ s, e: Number(e), titel: null, datum }))
pruefe('eine Staffel: Originaltage', originalTage({ folgen: folgen(1, ORIGINAL) })[12] === ORIGINAL[12])
pruefe('Staffel 0 (Specials) zählt nicht', originalTage({ folgen: [...folgen(0, { 1: '2000-01-01' }), ...folgen(1, ORIGINAL)] })[12] === ORIGINAL[12])
pruefe('zwei Staffeln: keine Zuordnung', Object.keys(originalTage({ folgen: [...folgen(1, ORIGINAL), ...folgen(2, ORIGINAL)] })).length === 0)
pruefe('Folge ohne Datum fehlt', originalTage({ folgen: folgen(1, { 1: null, 2: '2026-07-16' }) })[1] === undefined)

const r1 = release({})
const r2 = release({ wochentage: [3] })
const r3 = { ...release({}), releaseType: 'single' } as unknown as Release
const r4 = release({ observed: { ...SYNCHRO, 5: addDays(SYNCHRO[5], 4) } })
const geschrieben = schreibeNachOriginal([r1, r2, r3, r4], { '184356': { folgen: folgen(1, ORIGINAL) } })
pruefe('geschrieben nur an das stabile wöchentliche Release', geschrieben === 1 && r1.schedule.nachOriginal?.[12] === '2026-10-21')
pruefe('feste Sendetage, Einzeltermin, instabil: nichts', !r2.schedule.nachOriginal && !r3.schedule.nachOriginal && !r4.schedule.nachOriginal)
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
