/**
 * Eine Sendepause (`skipDates`) verschiebt die Zählung (13.11.2026, YAIBA auf ProSieben MAXX):
 * Fiel am Freitag die Sendung aus, läuft Folge 7 am Montag, nicht Folge 8.
 * Läuft in `check:logic`.
 */
import type { Release } from '../shared/types.ts'
import { expandEvents, lastEpisodeDate, sendeplatz } from '../shared/logic.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
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

if (fehler) process.exit(1)
console.log('check-sendepause-folge: ok (18 Fälle)')
