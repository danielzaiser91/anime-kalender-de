/**
 * Zusicherung zu angekündigten TV-Terminen von Hand (One Piece, YAIBA auf ProSieben MAXX, 10.10.2026):
 * ohne Beobachtung ist nur der Start belegt, der Rest ist geschätzt. Läuft in `check:logic`.
 */
import type { Release } from '../shared/types.ts'
import { expandEvents } from '../shared/logic.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

function tvRelease(schedule: Release['schedule']): Release {
  return { slug: 'hand-tv', titleId: 7, name: 'Hand', platform: 'tv', sender: 'Sender X', releaseType: 'weekly', schedule, year: 2026, sources: ['https://example.org/b'] } as Release
}

const plan = { firstEpisodeDate: '2026-11-05', episodeCount: 6, wochentage: [1, 2, 3, 4, 5] }
const ohne = expandEvents(tvRelease(plan))
pruefe('ohne Beobachtung: Folge 1 belegt, die übrigen geschätzt', !ohne[0]!.estimated && ohne.slice(1).every((e) => e.estimated), ohne.map((e) => e.estimated))
const mit = expandEvents(tvRelease({ ...plan, observed: { 1: '2026-11-05', 3: '2026-11-09' } }))
pruefe('mit Stützpunkten bleibt der Bereich dazwischen belegt', !mit[1]!.estimated && !mit[2]!.estimated && mit[3]!.estimated === true)
const wochentakt = expandEvents(tvRelease({ firstEpisodeDate: '2026-11-05', episodeCount: 3 }))
pruefe('ohne Sendetage ändert sich nichts', wochentakt.every((e) => !e.estimated), wochentakt.map((e) => e.estimated))
const einzel = expandEvents(tvRelease({ firstEpisodeDate: '2026-11-05', wochentage: [1, 2, 3, 4, 5] }))
pruefe('ein einzelner Termin bleibt belegt', einzel.length === 1 && !einzel[0]!.estimated)

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : 'TV-Schätzung: alle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
