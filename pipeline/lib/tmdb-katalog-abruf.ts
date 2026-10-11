import { sleep, warn } from './util.ts'
import { hatSicheren, suchNamen, urteilKatalog, type KatalogTitel, type KatalogTreffer, type Zuordnung } from './tmdb-katalog.ts'

const API = 'https://api.themoviedb.org/3'
/** Abstand zwischen zwei Anfragen: höchstens 4 je Sekunde (Vorgabe 11.10.2026: ≤ 5; TMDB selbst nennt rund 40). */
const PAUSE_MS = 250
/** Nach so vielen 429 hintereinander gibt der Titel auf (und bleibt ungesucht für den nächsten Lauf). */
const MAX_429 = 8

interface RohTreffer {
  media_type: string
  id: number
  title?: string
  name?: string
  original_title?: string
  original_name?: string
  release_date?: string
  first_air_date?: string
  genre_ids?: number[]
  original_language?: string
}

function kuerze(r: RohTreffer): KatalogTreffer {
  return {
    art: r.media_type === 'movie' ? 'movie' : 'tv',
    id: r.id,
    name: r.title ?? r.name,
    original: r.original_title ?? r.original_name,
    datum: r.release_date || r.first_air_date || undefined,
    genres: r.genre_ids,
    sprache: r.original_language,
  }
}

/** Eine Suche über Filme und Serien; bei 429 wird gewartet (Retry-After, sonst 10 s mal Versuch) statt abgebrochen. */
export async function sucheMulti(apiKey: string, name: string): Promise<KatalogTreffer[]> {
  for (let versuch = 1; versuch <= MAX_429; versuch++) {
    const antwort = await fetch(`${API}/search/multi?query=${encodeURIComponent(name)}&include_adult=false&api_key=${apiKey}`)
    await sleep(PAUSE_MS)
    if (antwort.status === 429) {
      const warte = (Number(antwort.headers.get('retry-after')) || 10 * versuch) * 1000
      warn(`TMDB 429 — Pause ${warte / 1000} s`)
      await sleep(warte)
      continue
    }
    if (!antwort.ok) throw new Error(`TMDB ${antwort.status} bei "${name}"`)
    const json = (await antwort.json()) as { results?: RohTreffer[] }
    return (json.results ?? []).filter((r) => r.media_type === 'movie' || r.media_type === 'tv').map(kuerze)
  }
  throw new Error(`TMDB 429 ohne Ende bei "${name}"`)
}

/** Sucht alle Namen eines Titels (bei einem sicheren Treffer hören die weiteren auf) und urteilt über die gesammelten Ergebnisse. */
export async function ordneZu(apiKey: string, t: KatalogTitel): Promise<Zuordnung> {
  const alle: KatalogTreffer[] = []
  for (const name of suchNamen(t)) {
    alle.push(...(await sucheMulti(apiKey, name)))
    if (hatSicheren(t, alle)) break
  }
  return urteilKatalog(t, alle)
}
