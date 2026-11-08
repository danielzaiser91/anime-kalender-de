/**
 * jpEnd aus AniList: Rückfall auf den Starttag nur bei Status FINISHED; laufende Titel ohne endDate haben kein Ende.
 * Läuft in `check:logic`.
 */
import { titleFromMedia } from './bau/titel-hilfen.ts'
import type { AniListMedia } from './lib/anilist.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

const medium = (status: string | null, endDate?: { year: number; month: number; day: number }): AniListMedia => {
  const m = {
    id: 900001,
    idMal: null,
    title: { romaji: 'Test', english: null, native: null },
    format: 'TV',
    status,
    episodes: 12,
    duration: 24,
    season: null,
    seasonYear: 2020,
    startDate: { year: 2020, month: 1, day: 5 },
    genres: [],
    tags: [],
    externalLinks: [],
    studios: { nodes: [] },
    coverImage: { large: null, extraLarge: null },
    bannerImage: null,
    averageScore: null,
    isAdult: false,
    description: null,
  }
  return (endDate ? { ...m, endDate } : m) as unknown as AniListMedia
}

const jpEnd = (m: AniListMedia) => titleFromMedia(m, 'high').jpEnd

pruefe('RELEASING ohne endDate: kein jpEnd', jpEnd(medium('RELEASING')) === undefined)
pruefe('NOT_YET_RELEASED ohne endDate: kein jpEnd', jpEnd(medium('NOT_YET_RELEASED')) === undefined)
pruefe('Status null ohne endDate: kein jpEnd', jpEnd(medium(null)) === undefined)
pruefe('CANCELLED ohne endDate: kein jpEnd', jpEnd(medium('CANCELLED')) === undefined)
pruefe('HIATUS ohne endDate: kein jpEnd', jpEnd(medium('HIATUS')) === undefined)
pruefe('FINISHED ohne endDate: Starttag', jpEnd(medium('FINISHED')) === '2020-01-05')
pruefe('FINISHED mit endDate: endDate', jpEnd(medium('FINISHED', { year: 2020, month: 3, day: 22 })) === '2020-03-22')
pruefe('RELEASING mit endDate: endDate', jpEnd(medium('RELEASING', { year: 2021, month: 6, day: 1 })) === '2021-06-01')

console.log(fehler ? `\njpEnd-FINISHED: ${fehler} Zusicherung(en) verletzt.` : 'jpEnd-FINISHED: 8 Zusicherungen halten.')
process.exit(fehler ? 1 : 0)
