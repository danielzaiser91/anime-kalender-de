import { fetchJson, sleep, warn } from './util.ts'
import type { Fsk, PlatformId } from '../../shared/types.ts'

const BASE = 'https://api.themoviedb.org/3'

export interface TmdbInfo {
  tmdbId?: number
  fsk?: Fsk
  providers?: PlatformId[]
  justwatchUrl?: string
}

const FSK_VALUES: Fsk[] = [0, 6, 12, 16, 18]

function parseFsk(raw: string | undefined): Fsk | undefined {
  if (!raw) return undefined
  const n = Number(raw.replace(/[^\d]/g, ''))
  return FSK_VALUES.includes(n as Fsk) ? (n as Fsk) : undefined
}

/** TMDB-Anbieternamen → interne Plattform-ID. */
function providerToPlatform(name: string): PlatformId | undefined {
  const n = name.toLowerCase()
  if (n.includes('crunchyroll')) return 'crunchyroll'
  if (n.includes('netflix')) return 'netflix'
  if (n.includes('disney')) return 'disneyplus'
  if (n.includes('amazon') || n.includes('prime video')) return 'primevideo'
  if (n.includes('animation digital network') || n.includes('adn')) return 'adn'
  if (n.includes('wow')) return 'wow'
  if (n.includes('joyn')) return 'joyn'
  if (n.includes('rtl')) return 'rtlplus'
  if (n.includes('aniverse')) return 'aniverse'
  return undefined
}

interface SearchResult {
  results: { id: number; name?: string; title?: string; first_air_date?: string; release_date?: string }[]
}

export async function lookupTmdb(
  apiKey: string,
  query: string,
  year: number | undefined,
  isMovie: boolean,
): Promise<TmdbInfo> {
  const kind = isMovie ? 'movie' : 'tv'
  const url =
    `${BASE}/search/${kind}?api_key=${apiKey}&language=de-DE&include_adult=false` +
    `&query=${encodeURIComponent(query)}` +
    (year ? `&${isMovie ? 'primary_release_year' : 'first_air_date_year'}=${year}` : '')

  let search: SearchResult
  try {
    search = await fetchJson<SearchResult>(url)
  } catch (err) {
    warn(`TMDB-Suche fehlgeschlagen für "${query}": ${(err as Error).message}`)
    return {}
  }
  const hit = search.results?.[0]
  if (!hit) return {}
  await sleep(60)

  const info: TmdbInfo = { tmdbId: hit.id }

  try {
    if (isMovie) {
      const rel = await fetchJson<{
        results: { iso_3166_1: string; release_dates: { certification: string }[] }[]
      }>(`${BASE}/movie/${hit.id}/release_dates?api_key=${apiKey}`)
      const de = rel.results?.find((r) => r.iso_3166_1 === 'DE')
      info.fsk = parseFsk(de?.release_dates?.find((r) => r.certification)?.certification)
    } else {
      const ratings = await fetchJson<{ results: { iso_3166_1: string; rating: string }[] }>(
        `${BASE}/tv/${hit.id}/content_ratings?api_key=${apiKey}`,
      )
      info.fsk = parseFsk(ratings.results?.find((r) => r.iso_3166_1 === 'DE')?.rating)
    }
    await sleep(60)

    const wp = await fetchJson<{
      results: Record<string, { link?: string; flatrate?: { provider_name: string }[]; buy?: { provider_name: string }[] }>
    }>(`${BASE}/${kind}/${hit.id}/watch/providers?api_key=${apiKey}`)
    const de = wp.results?.DE
    if (de) {
      info.justwatchUrl = de.link
      const names = [...(de.flatrate ?? []), ...(de.buy ?? [])].map((p) => p.provider_name)
      const platforms = [...new Set(names.map(providerToPlatform).filter(Boolean))] as PlatformId[]
      if (platforms.length) info.providers = platforms
    }
    await sleep(60)
  } catch (err) {
    warn(`TMDB-Details fehlgeschlagen für "${query}": ${(err as Error).message}`)
  }

  return info
}
