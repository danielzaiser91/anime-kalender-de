/** Prüft `lib/trailer-auswahl.ts`: Kandidaten des Trailerlaufs und die TMDB-Videoadresse. */
import { tmdbVideosUrl, trailerKandidaten } from './lib/trailer-auswahl.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const titel = [
  { id: 1, format: 'TV' },
  { id: 2, format: 'MOVIE' },
  { id: 3, format: 'TV' },
  { id: 4, format: 'OVA' },
  { id: 5, format: 'MOVIE' },
]
const ids = (einstiege: number[]): number[] => trailerKandidaten(titel, new Set(einstiege)).map((t) => t.id)

console.log('Trailer-Kandidaten')
pruefe('ohne Einstiege bleiben nur Filme', JSON.stringify(ids([])) === '[2,5]', ids([]))
pruefe('ein Einstieg als Serie kommt dazu, in Bestandsreihenfolge', JSON.stringify(ids([3])) === '[2,3,5]', ids([3]))
pruefe('ein Film im Einstieg steht nur einmal', JSON.stringify(ids([2, 1])) === '[1,2,5]', ids([2, 1]))
pruefe('eine OVA außerhalb des Pools bleibt draußen', !ids([1, 3]).includes(4))
pruefe('unbekannte Einstiegskennung ist egal', JSON.stringify(ids([99])) === '[2,5]', ids([99]))

console.log('TMDB-Videoadresse')
const tv = tmdbVideosUrl('https://x/3', 'tv', 7, 'K')
pruefe('Serie fragt tv und alle drei Sprachen', tv === 'https://x/3/tv/7/videos?include_video_language=de,en,ja&api_key=K', tv)
pruefe('Film fragt movie', tmdbVideosUrl('https://x/3', 'movie', 7, 'K').startsWith('https://x/3/movie/7/videos?'))
pruefe('unbekannte Art fällt auf tv', tmdbVideosUrl('https://x/3', 'anderes', 7, 'K').includes('/tv/7/'))

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('Trailer-Auswahl: alle Fälle grün')
