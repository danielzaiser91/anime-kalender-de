/**
 * Zusicherung zu TV-Terminen von Hand (One Piece auf ProSieben MAXX, 10.10.2026): Ein Handtermin ersetzt
 * die tv.de-Sichtungen erst ab seinem Start. Läuft in `check:logic`.
 */
import type { Release, Title } from '../shared/types.ts'
import { releasesAusTvProgramm } from './lib/tv-termine.ts'

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
const titles = new Map([[7, { id: 7, titleDe: 'Hand' } as Title]])
const sichtung = (tag: string) => ({ titleId: 7, titel: 'x', sender: 'Sender X', start: `${tag}T18:20:00+01:00`, ende: `${tag}T18:45:00+01:00`, gesehenAm: '2026-10-10' })
const sichtungen = [sichtung('2026-10-12'), sichtung('2026-10-13'), sichtung('2026-11-05'), sichtung('2026-11-06')]

const davor = releasesAusTvProgramm(sichtungen, titles, [tvRelease(plan)])
pruefe('Sichtungen vor dem Start bleiben als Termin stehen', davor.length === 1 && Object.values(davor[0]!.schedule.observed ?? {}).join() === '2026-10-12,2026-10-13', davor[0]?.schedule)
const ohneStart = releasesAusTvProgramm(sichtungen, titles, [tvRelease({ firstEpisodeDate: '' })])
pruefe('ein Handtermin ohne Starttag ersetzt alle Sichtungen', ohneStart.length === 0)
const spaeter = releasesAusTvProgramm([sichtung('2026-12-01')], titles, [tvRelease(plan)])
pruefe('nur spätere Sichtungen: nichts bleibt', spaeter.length === 0)

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : 'TV-Sichtungen vor dem Start: alle Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
