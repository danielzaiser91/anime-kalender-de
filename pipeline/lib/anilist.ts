import { sleep, warn } from './util.ts'

const ENDPOINT = 'https://graphql.anilist.co'

export interface AniListMedia {
  id: number
  idMal: number | null
  title: { romaji: string | null; english: string | null; native: string | null }
  format: string | null
  status: string | null
  episodes: number | null
  duration: number | null
  season: string | null
  seasonYear: number | null
  startDate: { year: number | null; month: number | null; day: number | null }
  genres: string[]
  tags: { name: string; rank: number; isMediaSpoiler: boolean; isAdult: boolean }[]
  externalLinks: { site: string; url: string; type: string | null }[]
  studios: { nodes: { name: string; isAnimationStudio?: boolean }[] }
  coverImage: { large: string | null; extraLarge: string | null }
  bannerImage: string | null
  averageScore: number | null
  isAdult: boolean
  description: string | null
  relations?: { edges: { relationType: string; node: { id: number; type: string } }[] }
  endDate?: { year: number | null; month: number | null; day: number | null }
}

const MEDIA_FIELDS = `
  id idMal
  title { romaji english native }
  format status episodes duration season seasonYear
  startDate { year month day }
  endDate { year month day }
  genres
  tags { name rank isMediaSpoiler isAdult }
  externalLinks { site url type }
  studios { nodes { name isAnimationStudio } }
  coverImage { large extraLarge }
  bannerImage
  averageScore isAdult
  description(asHtml: false)
  relations { edges { relationType node { id type } } }
`

interface GqlResponse<T> {
  data?: T
  errors?: { message: string }[]
}

/**
 * AniList erlaubt laut Doku 90 Requests/Minute, drosselt in der Praxis aber
 * härter. Deshalb: fester Mindestabstand plus Auswertung der Rate-Limit-Header.
 */
let minDelayMs = 750

async function gql<T>(query: string, variables: Record<string, unknown>, attempt = 0): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  })

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('retry-after') ?? 60)
    warn(`AniList Rate-Limit — warte ${retryAfter}s`)
    minDelayMs = Math.min(minDelayMs * 1.5, 4000)
    await sleep((retryAfter + 1) * 1000)
    if (attempt >= 5) throw new Error('AniList: zu oft rate-limited')
    return gql<T>(query, variables, attempt + 1)
  }
  if (res.status >= 500) {
    if (attempt >= 5) throw new Error(`AniList ${res.status}`)
    await sleep(2 ** attempt * 1000)
    return gql<T>(query, variables, attempt + 1)
  }

  const json = (await res.json()) as GqlResponse<T>
  if (json.errors?.length) {
    // "Not Found" ist bei Einzelabfragen ein normaler Fall, kein Abbruchgrund.
    const msg = json.errors.map((e) => e.message).join('; ')
    if (/not found/i.test(msg)) return {} as T
    throw new Error(`AniList: ${msg}`)
  }
  const remaining = Number(res.headers.get('x-ratelimit-remaining') ?? 90)
  if (remaining < 15) minDelayMs = Math.max(minDelayMs, 2000)
  await sleep(minDelayMs)
  return json.data as T
}

/** Holt Media-Einträge zu einer Liste von MAL-IDs, 50 Stück pro Request. */
export async function mediaByMalIds(
  malIds: number[],
  onProgress?: (done: number, total: number) => void,
): Promise<Map<number, AniListMedia>> {
  const out = new Map<number, AniListMedia>()
  const query = `query ($ids: [Int]) {
    Page(page: 1, perPage: 50) { media(idMal_in: $ids, type: ANIME) { ${MEDIA_FIELDS} } }
  }`

  for (let i = 0; i < malIds.length; i += 50) {
    const chunk = malIds.slice(i, i + 50)
    try {
      const data = await gql<{ Page: { media: AniListMedia[] } }>(query, { ids: chunk })
      for (const m of data?.Page?.media ?? []) {
        if (m.idMal != null) out.set(m.idMal, m)
      }
    } catch (err) {
      warn(`Batch ab Index ${i} fehlgeschlagen: ${(err as Error).message}`)
    }
    onProgress?.(Math.min(i + 50, malIds.length), malIds.length)
  }
  return out
}

/** Sucht einen Titel per Freitext — für kuratierte Einträge ohne ID. */
export async function searchMedia(term: string, year?: number): Promise<AniListMedia | undefined> {
  const query = `query ($search: String, $year: Int) {
    Page(page: 1, perPage: 5) {
      media(search: $search, type: ANIME, startDate_like: $year, sort: SEARCH_MATCH) { ${MEDIA_FIELDS} }
    }
  }`
  // startDate_like erwartet ein Muster wie 2026%, deshalb als String bauen.
  const q = year
    ? query.replace('$year: Int', '$year: String').replace('startDate_like: $year', 'startDate_like: $year')
    : query.replace(', $year: Int', '').replace(', startDate_like: $year', '')
  const vars: Record<string, unknown> = { search: term }
  if (year) vars.year = `${year}%`
  const data = await gql<{ Page: { media: AniListMedia[] } }>(q, vars)
  return data?.Page?.media?.[0]
}

export async function mediaById(id: number): Promise<AniListMedia | undefined> {
  const query = `query ($id: Int) { Media(id: $id, type: ANIME) { ${MEDIA_FIELDS} } }`
  const data = await gql<{ Media: AniListMedia }>(query, { id })
  return data?.Media
}
