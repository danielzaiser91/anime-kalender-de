/**
 * Eine Sendepause (`skipDates`) verschiebt die Zählung (13.11.2026, YAIBA auf ProSieben MAXX):
 * Fiel am Freitag die Sendung aus, läuft Folge 7 am Montag, nicht Folge 8.
 * Läuft in `check:logic`.
 */
import type { Release } from '../shared/types.ts'
import { expandEvents, lastEpisodeDate, sendeplatz } from '../shared/logic.ts'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

const MO_FR = [1, 2, 3, 4, 5]
function release(schedule: Record<string, unknown>): Release {
  return { slug: 'probe-sendepause', titleId: 900001, platform: 'tv', releaseType: 'weekly', schedule } as unknown as Release
}
const basis = { firstEpisodeDate: '2026-11-05', time: '18:25', episodeCount: 24, wochentage: MO_FR }
const datumVon = (r: Release, folge: number) => expandEvents(r).find((e) => e.episode === folge)?.date

const ohne = release(basis)
const mit = release({ ...basis, skipDates: ['2026-11-13'] })
pruefe('Kontrolle ohne Pause: Folge 7 am Freitag', datumVon(ohne, 7) === '2026-11-13', String(datumVon(ohne, 7)))
pruefe('mit Pause: Folge 7 am Montag danach', datumVon(mit, 7) === '2026-11-16', String(datumVon(mit, 7)))
pruefe('mit Pause: Folge 6 bleibt am Donnerstag', datumVon(mit, 6) === '2026-11-12', String(datumVon(mit, 6)))
pruefe('mit Pause: am Pausentag keine Folge', !expandEvents(mit).some((e) => e.date === '2026-11-13'))
pruefe('mit Pause: Folgenzahl bleibt 24', expandEvents(mit).length === 24, String(expandEvents(mit).length))

const beobachtet = { 1: '2026-11-05', 2: '2026-11-06', 3: '2026-11-09', 4: '2026-11-10', 5: '2026-11-11', 6: '2026-11-12' }
const rBeob = release({ ...basis, skipDates: ['2026-11-13'], observed: beobachtet })
pruefe('ab Stützpunkt Folge 6: Folge 7 am Montag', datumVon(rBeob, 7) === '2026-11-16', String(datumVon(rBeob, 7)))
pruefe('ab Stützpunkt Folge 6: Folge 8 am Dienstag', datumVon(rBeob, 8) === '2026-11-17', String(datumVon(rBeob, 8)))

const zwischen = release({ ...basis, skipDates: ['2026-11-13'], observed: { ...beobachtet, 9: '2026-11-18' } })
pruefe('zwischen zwei Stützpunkten: Folge 7 am Montag', datumVon(zwischen, 7) === '2026-11-16', String(datumVon(zwischen, 7)))
pruefe('zwischen zwei Stützpunkten: Folge 8 am Dienstag', datumVon(zwischen, 8) === '2026-11-17', String(datumVon(zwischen, 8)))
const rueckwaerts = release({ ...basis, skipDates: ['2026-11-13'], observed: { 9: '2026-11-18' } })
pruefe('rückwärts vom Stützpunkt Folge 9: Folge 7 am Montag', datumVon(rueckwaerts, 7) === '2026-11-16', String(datumVon(rueckwaerts, 7)))
pruefe('rückwärts vom Stützpunkt Folge 9: Folge 6 am Donnerstag', datumVon(rueckwaerts, 6) === '2026-11-12', String(datumVon(rueckwaerts, 6)))

const woche = { firstEpisodeDate: '2026-11-05', episodeCount: 5 }
const wo = release({ ...woche, skipDates: ['2026-11-19'] })
pruefe('Wochentakt ohne Sendetage: Pause schiebt Folge 3 um eine Woche', datumVon(wo, 3) === '2026-11-26', String(datumVon(wo, 3)))
pruefe('Wochentakt: Ende stimmt mit lastEpisodeDate überein', expandEvents(wo).at(-1)?.date === lastEpisodeDate(wo), String(lastEpisodeDate(wo)))
pruefe('Ende mit Sendetagen stimmt überein', expandEvents(mit).at(-1)?.date === lastEpisodeDate(mit), String(lastEpisodeDate(mit)))

pruefe('sendeplatz ohne Pausenmenge unverändert', sendeplatz({ ...basis } as never, '2026-11-12', 1) === '2026-11-13')
pruefe('sendeplatz überspringt Pausentag', sendeplatz({ ...basis } as never, '2026-11-12', 1, new Set(['2026-11-13'])) === '2026-11-16')

const tage = (r: Release) => expandEvents(r).map((e) => `${e.date}#${e.episode}`).join(' ')
const endeGleich = (r: Release) => expandEvents(r).at(-1)?.date === lastEpisodeDate(r)

/* Start auf einem Pausentag: Folge 1 rückt auf den nächsten Sendeplatz, statt wegzufallen. */
const startPause = release({ ...basis, skipDates: ['2026-11-05'] })
pruefe('Start auf Pausentag: Folge 1 am Freitag danach', datumVon(startPause, 1) === '2026-11-06', tage(startPause))
pruefe('Start auf Pausentag: Folge 2 am Montag', datumVon(startPause, 2) === '2026-11-09', tage(startPause))
pruefe('Start auf Pausentag: alle 24 Folgen da', expandEvents(startPause).length === 24, String(expandEvents(startPause).length))
pruefe('Start auf Pausentag: Ende stimmt mit lastEpisodeDate überein', endeGleich(startPause), String(lastEpisodeDate(startPause)))
const startPauseWoche = release({ ...woche, skipDates: ['2026-11-05'] })
pruefe('Wochentakt, Start auf Pausentag: Folge 1 eine Woche später', datumVon(startPauseWoche, 1) === '2026-11-12', tage(startPauseWoche))
pruefe('Wochentakt, Start auf Pausentag: Ende stimmt', endeGleich(startPauseWoche), String(lastEpisodeDate(startPauseWoche)))

/* Termin aus der Originaltabelle auf einem Pausentag: geschoben wie in `lastEpisodeDate`, nicht verworfen. */
const original = release({
  firstEpisodeDate: '2026-09-22',
  episodeCount: 12,
  wochentage: MO_FR,
  observed: { 1: '2026-09-22' },
  nachOriginal: { 12: '2026-10-21' },
  skipDates: ['2026-10-21'],
})
pruefe('nachOriginal auf Pausentag: alle 12 Folgen da', expandEvents(original).length === 12, tage(original))
pruefe('nachOriginal auf Pausentag: Folge 12 eine Woche später', datumVon(original, 12) === '2026-10-28', tage(original))
pruefe('nachOriginal auf Pausentag: Ende stimmt mit lastEpisodeDate überein', endeGleich(original), String(lastEpisodeDate(original)))

/* One Piece auf ProSieben MAXX (tv-2026.yaml): ab Folge 780, Mo–Fr, Fußball am 13.11. und 17.11. (tv.de). */
const onePiece = release({ ...basis, firstEpisodeNumber: 780, episodeCount: 98, skipDates: ['2026-11-13', '2026-11-17'] })
const opPlan = { 785: '2026-11-12', 786: '2026-11-16', 787: '2026-11-18', 788: '2026-11-19', 789: '2026-11-20' }
for (const [folge, tag] of Object.entries(opPlan)) {
  pruefe(`One Piece: Folge ${folge} am ${tag}`, datumVon(onePiece, Number(folge)) === tag, String(datumVon(onePiece, Number(folge))))
}
pruefe('One Piece: an beiden Pausentagen keine Folge', !expandEvents(onePiece).some((e) => e.date === '2026-11-13' || e.date === '2026-11-17'))
pruefe('One Piece: 98 Folgen, Ende stimmt', expandEvents(onePiece).length === 98 && endeGleich(onePiece), String(lastEpisodeDate(onePiece)))

/* Festlegung: Zeigt ein Stützpunkt (etwa eine Programmvorschau vor dem Ausfall) auf einen Pausentag, gilt die Pause. */
const sichtungAmPausentag = release({ ...basis, skipDates: ['2026-11-13'], observed: { 6: '2026-11-12', 7: '2026-11-13' } })
pruefe('Stützpunkt auf Pausentag: dort keine Folge', !expandEvents(sichtungAmPausentag).some((e) => e.date === '2026-11-13'), tage(sichtungAmPausentag))

/* Die Kollisionsauflösung schiebt über Pausen: Polar Opposites S2 (check-logic), dazu eine Pause am 04.10. */
const kollision = (skipDates: string[]) =>
  release({
    firstEpisodeDate: '2026-07-26',
    episodeCount: 10,
    observed: { 7: '2026-09-06' },
    verpasst: {
      8: { erwartetAm: '2026-09-13T08:30:00.000Z' },
      9: { erwartetAm: '2026-09-20T08:30:00.000Z', neuErwartet: '2026-09-27T08:30:00.000Z' },
    },
    skipDates,
  })
pruefe('Kontrolle Kollision ohne Pause: Folge 9 rückt auf den 04.10.', datumVon(kollision([]), 9) === '2026-10-04', tage(kollision([])))
pruefe('Kollision mit Pause 04.10.: Folge 9 rückt auf den 11.10.', datumVon(kollision(['2026-10-04']), 9) === '2026-10-11', tage(kollision(['2026-10-04'])))
pruefe('Kollision mit Pause: am 04.10. keine Folge', !expandEvents(kollision(['2026-10-04'])).some((e) => e.date === '2026-10-04'))

if (fehler) process.exit(1)
console.log(`check-sendepause-folge: ok (${faelle} Fälle)`)
