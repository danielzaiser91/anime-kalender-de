/**
 * **Zweitanbieter** (10.10.2026): Ein Streaming-Termin trägt die Marke, wenn dieselbe Folge desselben Titels
 * (AniList-ID, Film = Folge 1) bei einem anderen Streaming-Anbieter mindestens `ZWEITANBIETER_MIN_TAGE` früher
 * erschien. Kürzere Abstände sind Simulcast: beide sind Erste. TV, Disc und Kino liegen außerhalb der Regel,
 * ein Handbeleg „Premiere“ schlägt die Marke. Ein Termin ohne Folgennummer (Katalog, Batch) trägt keine: „Im Angebot seit“
 * ist nicht „erschienen am“ (11.10.2026). Gerechnet wird im Bau, damit Seite, ICS und Newsletter dasselbe sagen.
 */
import type { PlatformId, Release, ReleaseEvent, Title } from './types.ts'
import { anbieterDesKanals } from './kanal-anbieter.ts'

/** Abstand, ab dem ein späterer Anbieter „Zweitanbieter“ heißt; darunter gelten beide als gleichzeitig. */
export const ZWEITANBIETER_MIN_TAGE = 7

/** Der Erste, den der Besucher kennen soll: Anbieter und Tag; `mindestens` bei „Im Angebot seit“ (Katalogdatum). */
export interface Zweitanbieter {
  erster: PlatformId
  seit: string
  mindestens?: true
}

/* Das Feld hängt per Erweiterung am Termin: `shared/types.ts` liegt über der Dateigrenze und wächst nicht mehr. */
declare module './types.ts' {
  interface ReleaseEvent {
    /** Dieselbe Folge lief bei einem anderen Streaming-Anbieter mindestens `ZWEITANBIETER_MIN_TAGE` früher. */
    zweitanbieter?: Zweitanbieter
  }
}

const KEIN_STREAMING = new Set<PlatformId>(['tv', 'disc', 'kino', 'unbekannt'])

const istStreaming = (e: ReleaseEvent): boolean => !KEIN_STREAMING.has(e.platform) && e.releaseType !== 'disc'

const tage = (von: string, bis: string): number => (Date.parse(bis) - Date.parse(von)) / 864e5

const folgeKey = (e: ReleaseEvent): string => `${e.titleId}|${e.episode ?? 1}`

/**
 * Titel, deren Prime-Weg ein Kanal mit eigenem Anbieter ist (Crunchyroll, ADN): Der Kanal ist derselbe Anbieter, kein
 * zweiter Erster — der echte Anbieter gilt (Daniel, 25.10.2026). Kanäle ohne eigene Domain (Aniverse) bleiben Prime.
 */
export function primeKanalAnbieter(titles: Iterable<Title>): Map<number, PlatformId> {
  const je = new Map<number, PlatformId>()
  for (const t of titles) {
    const anbieter = new Set(t.streams.filter((s) => s.platform === 'primevideo').map((s) => anbieterDesKanals(s.kanal)))
    const [einer] = anbieter
    if (anbieter.size === 1 && einer) je.set(t.id, einer)
  }
  return je
}

/** Setzt `zweitanbieter` an die betroffenen Termine; liefert deren Zahl und die Termine, an denen ein Handbeleg widerspricht. */
export function schreibeZweitanbieter(
  events: ReleaseEvent[],
  releases: Release[],
  kanalAnbieter: ReadonlyMap<number, PlatformId>,
): { anzahl: number; kollisionen: string[] } {
  const anbieter = (e: ReleaseEvent): PlatformId => (e.platform === 'primevideo' && kanalAnbieter.get(e.titleId)) || e.platform
  const katalog = new Set(releases.filter((r) => r.dateMeaning === 'available-from').map((r) => r.slug))
  const stream = events.filter(istStreaming)
  const fruehest = new Map<string, ReleaseEvent>()
  for (const e of stream) {
    /* Ein zurückgerechneter oder fortgeschriebener Tag belegt nicht, dass jemand der Erste war (Snowball Earth, 13.10.2026). */
    if (e.estimated) continue
    const f = fruehest.get(folgeKey(e))
    if (!f || e.date < f.date) fruehest.set(folgeKey(e), e)
  }
  const kollisionen: string[] = []
  let anzahl = 0
  for (const e of stream) {
    const f = fruehest.get(folgeKey(e))
    if (!f || (e.episode === undefined && e.releaseType !== 'movie')) continue
    if (anbieter(f) === anbieter(e) || tage(f.date, e.date) < ZWEITANBIETER_MIN_TAGE) continue
    if (e.premiere) {
      kollisionen.push(`"${e.releaseSlug}" ${e.date}: Handbeleg „Premiere“, aber ${f.platform} brachte Folge ${e.episode ?? 1} schon am ${f.date}`)
      continue
    }
    e.zweitanbieter = { erster: anbieter(f), seit: f.date, ...(katalog.has(f.releaseSlug) && { mindestens: true as const }) }
    anzahl++
  }
  return { anzahl, kollisionen }
}
