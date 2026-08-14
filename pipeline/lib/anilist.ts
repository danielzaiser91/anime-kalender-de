import { ANILIST_COVER_BASIS, FRANCHISE_RELATIONS } from '../../shared/mappings.ts'
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

/**
 * Ein Anime aus dem Gesamtkatalog — bewusst mager.
 *
 * Zu diesen Titeln wissen wir nichts über deutsche Fassungen, weil es keine
 * gibt. Gespeichert wird deshalb nur, was zum Finden und Wiedererkennen reicht.
 * Sobald eine Synchro belegt ist, wandert der Titel in den gepflegten Bestand
 * und wird dort vollständig geholt.
 */
export interface KatalogEintrag {
  id: number
  /** Romaji, Englisch, Japanisch — alle drei, weil alle drei gesucht werden. */
  t: [string | null, string | null, string | null]
  format: string | null
  jahr: number | null
  folgen: number | null
  genres: string[]
  score: number | null
  /**
   * Cover **ohne** Adressvorsatz — nur der Dateiname.
   *
   * Die vollen AniList-Adressen sind rund 70 Zeichen lang und beginnen alle
   * gleich. Bei 20.000 Titeln sind das 1,2 MB, die niemand braucht: Der
   * Vorsatz wird beim Anzeigen wieder angehängt (`COVER_BASIS`).
   */
  cover: string | null
  /**
   * Kennungen verwandter Anime — nur die Beziehungen aus `FRANCHISE_RELATIONS`.
   *
   * Ohne dieses Feld gibt es für Titel ohne deutsche Synchro keine
   * `franchiseId`, und „Staffeln zusammenfassen" wirkt auf sie nicht: „Link
   * Click" stand mit sieben Kacheln nebeneinander, obwohl der Schalter an war
   * (Daniel, 13.08.2026, mit Bild). Gefiltert wird schon beim Abruf, damit im
   * Zwischenspeicher nur landet, was auch gebraucht wird.
   */
  rel: number[]
}


/** Formate, die als Anime-Titel zählen — `MUSIC` sind Musikvideos. */
const KATALOG_FORMATE = ['TV', 'TV_SHORT', 'MOVIE', 'SPECIAL', 'OVA', 'ONA']

/**
 * Eine Seite des Gesamtkatalogs.
 *
 * **Warum jahrweise abgefragt wird:** AniList lässt je Abfrage nur 5.000
 * Einträge durchblättern („Page depth exceeds maximum allowed"), das sind bei
 * 50 je Seite genau 100 Seiten. Der Bestand ist deutlich größer. Ein Zeiger auf
 * die Kennung wäre die elegante Lösung, aber `id_greater` gibt es nicht — nur
 * `id_in` und `id_not_in`. Also wird nach Startjahr zerlegt; kein Jahr kommt
 * der Grenze auch nur nahe.
 *
 * `pageInfo.total` ist dabei **nutzlos**: Es meldet für jedes Jahr 5.000, weil
 * AniList dort denselben Deckel anlegt. Gezählt wird deshalb über
 * `hasNextPage`, nicht über `total`.
 *
 * Ohne `von`/`bis` läuft die Abfrage über den ganzen Bestand — gebraucht für
 * den Nachlauf über die jüngsten Kennungen, der Titel ohne Startdatum einsammelt.
 */
export async function katalogSeite(
  seite: number,
  von?: number,
  bis?: number,
  absteigend = false,
): Promise<{ eintraege: KatalogEintrag[]; weiter: boolean }> {
  const datumsFilter = von !== undefined ? 'startDate_greater: $von, startDate_lesser: $bis,' : ''
  const datumsArgs = von !== undefined ? '$von: FuzzyDateInt, $bis: FuzzyDateInt,' : ''
  const query = `query ($p: Int, ${datumsArgs} $f: [MediaFormat]) {
    Page(page: $p, perPage: 50) {
      pageInfo { hasNextPage }
      media(type: ANIME, isAdult: false, format_in: $f, ${datumsFilter} sort: ${absteigend ? 'ID_DESC' : 'ID'}) {
        id
        title { romaji english native }
        format episodes seasonYear averageScore
        genres
        coverImage { large }
        relations { edges { relationType node { id type } } }
      }
    }
  }`
  const vars: Record<string, unknown> = { p: seite, f: KATALOG_FORMATE }
  if (von !== undefined) {
    vars.von = von
    vars.bis = bis
  }

  const data = await gql<{
    Page: {
      pageInfo: { hasNextPage: boolean }
      media: {
        id: number
        title: { romaji: string | null; english: string | null; native: string | null }
        format: string | null
        episodes: number | null
        seasonYear: number | null
        averageScore: number | null
        genres: string[]
        coverImage: { large: string | null }
        relations?: { edges: { relationType: string; node: { id: number; type: string } }[] }
      }[]
    }
  }>(query, vars)

  return {
    weiter: data?.Page?.pageInfo?.hasNextPage ?? false,
    eintraege: (data?.Page?.media ?? []).map((m) => ({
      id: m.id,
      t: [m.title.romaji, m.title.english, m.title.native],
      format: m.format,
      jahr: m.seasonYear,
      folgen: m.episodes,
      genres: m.genres ?? [],
      score: m.averageScore,
      cover: m.coverImage?.large?.startsWith(ANILIST_COVER_BASIS)
        ? m.coverImage.large.slice(ANILIST_COVER_BASIS.length)
        : (m.coverImage?.large ?? null),
      rel: (m.relations?.edges ?? [])
        .filter((e) => FRANCHISE_RELATIONS.has(e.relationType) && e.node?.type === 'ANIME')
        .map((e) => e.node.id),
    })),
  }
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

/** Eine Sprechrolle: Figur, deutsche Stimme, dazu die japanische zum Vergleich. */
export interface VoiceRole {
  character: string
  /** Deutsche Sprecherin oder Sprecher. */
  actor: string
  /** 'MAIN' | 'SUPPORTING' | 'BACKGROUND' — die Reihenfolge kommt von AniList. */
  role?: string
}

/**
 * Holt die deutschen Sprechrollen zu mehreren Titeln.
 *
 * Warum AniList und nicht die Deutsche Synchronkartei, die ungleich mehr hat:
 * Deren rechtliche Hinweise untersagen automatisiertes Auslesen wörtlich
 * („Insbesondere ist ein automatisiertes Auslesen des Internetangebots nicht
 * gestattet"). AniList dagegen betreibt die Schnittstelle ausdrücklich für
 * genau solche Zugriffe — und wir fragen sie ohnehin schon ab.
 *
 * Zehn Titel je Anfrage: Die Figurenliste ist eine verschachtelte Abfrage,
 * größere Bündel treiben die Kosten je Anfrage unnötig hoch.
 *
 * **Nur eine Sprache je Abfrage.** AniList löst das Feld voiceActors pro
 * Auswahl genau einmal auf: Steht es zweimal mit verschiedenen Sprachen da,
 * gewinnt die letzte — und zwar für beide Felder. Aliasse helfen nicht, sie
 * machen es schlimmer, weil dann beide die japanischen Namen liefern. Der
 * Fehler ist still und plausibel: Die Liste ist gefüllt, die Namen sehen nach
 * Sprechern aus, nur spricht Yuuka Nanri kein Deutsch. Wer die japanische
 * Besetzung dazu will, braucht eine zweite Abfrage.
 */
export async function germanVoicesFor(
  ids: number[],
  onProgress?: (done: number, total: number) => void,
): Promise<Map<number, VoiceRole[]>> {
  const out = new Map<number, VoiceRole[]>()
  const query = `query ($ids: [Int]) {
    Page(page: 1, perPage: 10) {
      media(id_in: $ids, type: ANIME) {
        id
        characters(sort: [ROLE, RELEVANCE], perPage: 25) {
          edges {
            role
            node { name { full } }
            voiceActors(language: GERMAN) { name { full } }
          }
        }
      }
    }
  }`

  for (let i = 0; i < ids.length; i += 10) {
    const chunk = ids.slice(i, i + 10)
    try {
      const data = await gql<{
        Page: {
          media: {
            id: number
            characters: {
              edges: {
                role: string | null
                node: { name: { full: string | null } }
                voiceActors: { name: { full: string | null } }[]
              }[]
            }
          }[]
        }
      }>(query, { ids: chunk })

      for (const m of data?.Page?.media ?? []) {
        const rollen: VoiceRole[] = []
        for (const kante of m.characters?.edges ?? []) {
          const stimme = kante.voiceActors?.[0]?.name?.full
          const figur = kante.node?.name?.full
          if (!stimme || !figur) continue
          rollen.push({ character: figur, actor: stimme, role: kante.role ?? undefined })
        }
        if (rollen.length) out.set(m.id, rollen)
      }
    } catch (err) {
      warn(`Sprecher-Bündel ab Index ${i} fehlgeschlagen: ${(err as Error).message}`)
    }
    onProgress?.(Math.min(i + 10, ids.length), ids.length)
  }
  return out
}

export async function mediaById(id: number): Promise<AniListMedia | undefined> {
  const query = `query ($id: Int) { Media(id: $id, type: ANIME) { ${MEDIA_FIELDS} } }`
  const data = await gql<{ Media: AniListMedia }>(query, { id })
  return data?.Media
}
