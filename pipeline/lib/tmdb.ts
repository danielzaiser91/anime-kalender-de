import { fetchJson, sleep, warn } from './util.ts'
import type { Fsk, PlatformId } from '../../shared/types.ts'

const BASE = 'https://api.themoviedb.org/3'

/** Ein Angebot, wie TMDB (Datenbasis JustWatch) es für Deutschland führt. */
export interface TmdbOffer {
  name: string
  /** flatrate = im Abo, rent = leihen, buy = kaufen. */
  kind: 'flatrate' | 'rent' | 'buy'
}

export interface TmdbInfo {
  tmdbId?: number
  fsk?: Fsk
  providers?: PlatformId[]
  /**
   * Die **vollständige** Anbieterliste, nicht nur die Dienste mit eigener
   * Plattform.
   *
   * Vorher wurde alles verworfen, was `providerToPlatform` nicht kannte —
   * also Videobuster, maxdome, Sky Store, Apple TV, Google Play. Genau die
   * Angebote, die bei alten Titeln oft die einzigen sind. Die Daten waren
   * immer da, wir haben sie nur weggeworfen.
   */
  offers?: TmdbOffer[]
  /** TMDBs Übersichtsseite mit allen Anbieterlinks für die Region. */
  justwatchUrl?: string
}

/** Liest `flatrate`, `rent` und `buy` aus einer watch/providers-Antwort. */
export function readOffers(de: {
  flatrate?: { provider_name: string }[]
  rent?: { provider_name: string }[]
  buy?: { provider_name: string }[]
}): TmdbOffer[] {
  const out: TmdbOffer[] = []
  for (const kind of ['flatrate', 'rent', 'buy'] as const) {
    for (const p of de[kind] ?? []) {
      if (!out.some((o) => o.name === p.provider_name)) out.push({ name: p.provider_name, kind })
    }
  }
  return out
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
      results: Record<
        string,
        {
          link?: string
          flatrate?: { provider_name: string }[]
          rent?: { provider_name: string }[]
          buy?: { provider_name: string }[]
        }
      >
    }>(`${BASE}/${kind}/${hit.id}/watch/providers?api_key=${apiKey}`)
    const de = wp.results?.DE
    if (de) {
      info.justwatchUrl = de.link
      const offers = readOffers(de)
      if (offers.length) info.offers = offers
      const platforms = [
        ...new Set(offers.map((o) => providerToPlatform(o.name)).filter(Boolean)),
      ] as PlatformId[]
      if (platforms.length) info.providers = platforms
    }
    await sleep(60)
  } catch (err) {
    warn(`TMDB-Details fehlgeschlagen für "${query}": ${(err as Error).message}`)
  }

  return info
}
