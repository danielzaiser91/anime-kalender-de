import type {
  DubConfidence,
  Fsk,
  PlatformId,
  Release,
  ReleaseEvent,
  ReleaseStatus,
  ReleaseType,
  Title,
} from '@shared/types.ts'
import { releaseStatus, titleStatus } from '@shared/logic.ts'
import type { Dataset } from './data.ts'

/**
 * Die Listen, die es sowohl als Einschluss als auch als Ausschluss gibt.
 * Als eigener Typ, damit beide Seiten nicht auseinanderlaufen können.
 */
export interface FilterLists {
  platforms: PlatformId[]
  /**
   * Bezugsquellen jenseits der neun bekannten Plattformen — maxdome, Apple TV,
   * Videobuster, die Prime-Video-Kanäle. Als Klartextnamen, weil sie keine
   * feste Kennung haben; die Schreibweise vereinheitlicht `providerName` schon
   * beim Bauen des Datensatzes.
   */
  providers: string[]
  releaseTypes: ReleaseType[]
  statuses: ReleaseStatus[]
  fsk: Fsk[]
  years: number[]
  genres: string[]
  keywords: string[]
}

export type ListKey = keyof FilterLists

export const LIST_KEYS: ListKey[] = [
  'platforms',
  'providers',
  'releaseTypes',
  'statuses',
  'fsk',
  'years',
  'genres',
  'keywords',
]

export interface FilterState extends FilterLists {
  /**
   * Was **nicht** vorkommen darf. Ausschluss schlägt Einschluss: Wer „Fantasy"
   * wählt und „Ecchi" ausschließt, will Fantasy ohne Ecchi — nicht beides.
   */
  excluded: FilterLists
  search: string
  /** Blendet Termine aus, die nur abgeleitet sind. */
  confirmedOnly: boolean
  /** Zeigt nur gemerkte Titel. */
  favoritesOnly: boolean
  /**
   * Zeigt nur Titel, bei denen belegt ist, wo man sie sehen oder kaufen kann.
   *
   * Der Kalender kennt 2.753 Anime mit belegter deutscher Synchro, aber nur
   * gut hundert davon haben einen anstehenden Termin. Die übrigen sind nicht
   * weniger interessant — bei ihnen ist die Frage bloß nicht „wann", sondern
   * „wo". Für rund 2.000 gibt es darauf inzwischen eine Antwort, sie war nur
   * nicht auffindbar (eingeführt 10.08.2026).
   */
  availableOnly: boolean
  /** Mindest-Vertrauensstufe der Dub-Angabe (nur Datenbank-Ansicht). */
  minConfidence: DubConfidence
}

const emptyLists = (): FilterLists => ({
  platforms: [],
  providers: [],
  releaseTypes: [],
  statuses: [],
  fsk: [],
  years: [],
  genres: [],
  keywords: [],
})

export const EMPTY_FILTERS: FilterState = {
  ...emptyLists(),
  excluded: emptyLists(),
  search: '',
  confirmedOnly: false,
  favoritesOnly: false,
  availableOnly: false,
  minConfidence: 'low',
}

export { emptyLists }

/**
 * Schaltet einen Wert um — je nach Modus als Einschluss oder als Ausschluss.
 *
 * Der Wechsel räumt die jeweils andere Seite mit auf: Ein Genre kann nicht
 * gleichzeitig gefordert und verboten sein, und ein Klick, der beides stehen
 * ließe, würde eine Filterung erzeugen, die nie ein Ergebnis hat.
 */
export function toggleFilter<K extends ListKey>(
  filters: FilterState,
  key: K,
  value: FilterLists[K][number],
  mode: 'include' | 'exclude',
): FilterState {
  const include = filters[key] as FilterLists[K]
  const exclude = filters.excluded[key] as FilterLists[K]
  const target = mode === 'include' ? include : exclude
  const other = mode === 'include' ? exclude : include

  const nextTarget = (target as unknown[]).includes(value)
    ? (target as unknown[]).filter((v) => v !== value)
    : [...(target as unknown[]), value]
  const nextOther = (other as unknown[]).filter((v) => v !== value)

  return mode === 'include'
    ? { ...filters, [key]: nextTarget, excluded: { ...filters.excluded, [key]: nextOther } }
    : { ...filters, [key]: nextOther, excluded: { ...filters.excluded, [key]: nextTarget } }
}

/** 'include' | 'exclude' | undefined — wie ein Wert gerade gesetzt ist. */
export function filterMode<K extends ListKey>(
  filters: FilterState,
  key: K,
  value: FilterLists[K][number],
): 'include' | 'exclude' | undefined {
  if ((filters[key] as unknown[]).includes(value)) return 'include'
  if ((filters.excluded[key] as unknown[]).includes(value)) return 'exclude'
  return undefined
}

const CONFIDENCE_RANK: Record<DubConfidence, number> = {
  low: 0,
  normal: 1,
  high: 2,
  'very-high': 3,
}

export function isFilterActive(f: FilterState): boolean {
  return activeFilterCount(f) > 0
}

export function activeFilterCount(f: FilterState): number {
  const lists = LIST_KEYS.reduce((sum, key) => sum + f[key].length + f.excluded[key].length, 0)
  return (
    lists +
    (f.search.trim() ? 1 : 0) +
    (f.confirmedOnly ? 1 : 0) +
    (f.favoritesOnly ? 1 : 0) +
    (f.availableOnly ? 1 : 0) +
    (f.minConfidence !== 'low' ? 1 : 0)
  )
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[äÄ]/g, 'a')
    .replace(/[öÖ]/g, 'o')
    .replace(/[üÜ]/g, 'u')
    .replace(/ß/g, 'ss')
}

function matchesSearch(term: string, release: Release, title: Title | undefined): boolean {
  const haystack = [
    release.name,
    release.publisher,
    release.edition,
    title?.titleDe,
    title?.titleEn,
    title?.titleRomaji,
    title?.titleNative,
    ...(title?.studios ?? []),
    ...(title?.genres ?? []),
    ...(title?.keywords ?? []),
  ]
    .filter(Boolean)
    .map((v) => normalize(String(v)))
  const needle = normalize(term)
  return haystack.some((h) => h.includes(needle))
}

function titleMatchesSearch(term: string, title: Title): boolean {
  const haystack = [
    title.titleDe,
    title.titleEn,
    title.titleRomaji,
    title.titleNative,
    ...(title.studios ?? []),
    ...title.genres,
    ...title.keywords,
  ]
    .filter(Boolean)
    .map((v) => normalize(String(v)))
  const needle = normalize(term)
  return haystack.some((h) => h.includes(needle))
}

/** Prüft einen einzelnen Release gegen die Filter. */
export function releaseMatches(
  release: Release,
  title: Title | undefined,
  f: FilterState,
  today: string,
): boolean {
  const status = releaseStatus(release, today)
  const genres = title?.genres ?? []
  const keywords = title?.keywords ?? []

  // Ausschluss zuerst — er schlägt jeden Einschluss.
  const x = f.excluded
  if (x.platforms.includes(release.platform)) return false
  if (x.releaseTypes.includes(release.releaseType)) return false
  if (x.years.includes(release.year)) return false
  if (release.fsk !== undefined && x.fsk.includes(release.fsk)) return false
  if (x.statuses.includes(status)) return false
  if (x.genres.some((g) => genres.includes(g))) return false
  if (x.keywords.some((k) => keywords.includes(k))) return false

  if (f.platforms.length && !f.platforms.includes(release.platform)) return false
  if (f.releaseTypes.length && !f.releaseTypes.includes(release.releaseType)) return false
  if (f.years.length && !f.years.includes(release.year)) return false
  if (f.confirmedOnly && release.schedule.estimated) return false

  if (f.fsk.length) {
    if (release.fsk === undefined) return false
    if (!f.fsk.includes(release.fsk)) return false
  }
  if (f.statuses.length && !f.statuses.includes(status)) return false

  if (f.genres.length && !f.genres.every((g) => genres.includes(g))) return false
  if (f.keywords.length && !f.keywords.every((k) => keywords.includes(k))) return false
  if (f.search.trim() && !matchesSearch(f.search.trim(), release, title)) return false
  return true
}

export function filterEvents(
  data: Dataset,
  f: FilterState,
  today: string,
  favorites: Set<number>,
): ReleaseEvent[] {
  const allowed = new Set(
    data.releases
      .filter((r) => !f.favoritesOnly || favorites.has(r.titleId))
      .filter((r) => releaseMatches(r, data.titleById.get(r.titleId), f, today))
      .map((r) => r.slug),
  )
  return data.events.filter((e) => allowed.has(e.releaseSlug))
}

/** Filter für die Datenbank-Ansicht: arbeitet auf Anime statt auf Terminen. */
export function filterTitles(
  source: Title[],
  data: Dataset,
  f: FilterState,
  today: string,
  favorites: Set<number>,
): Title[] {
  return source.filter((t) => {
    if (f.favoritesOnly && !favorites.has(t.id)) return false
    // „Wo kann ich das sehen?" — Stream-Verweise aus AniList/TMDB oder
    // Bezugsquellen aus aniSearch. Ein Termin zählt selbstverständlich auch.
    if (
      f.availableOnly &&
      !t.streams.length &&
      !(t.watchLinks?.length ?? 0) &&
      !(data.releasesByTitle.get(t.id)?.length ?? 0)
    ) {
      return false
    }
    if (CONFIDENCE_RANK[t.dubConfidence] < CONFIDENCE_RANK[f.minConfidence]) return false

    const x = f.excluded
    if (x.genres.some((g) => t.genres.includes(g))) return false
    if (x.keywords.some((k) => t.keywords.includes(k))) return false
    if (t.fsk !== undefined && x.fsk.includes(t.fsk)) return false

    if (f.genres.length && !f.genres.every((g) => t.genres.includes(g))) return false
    if (f.keywords.length && !f.keywords.every((k) => t.keywords.includes(k))) return false
    if (f.fsk.length && (t.fsk === undefined || !f.fsk.includes(t.fsk))) return false

    const releases = data.releasesByTitle.get(t.id) ?? []
    const platformsOf = new Set([...releases.map((r) => r.platform), ...t.streams.map((s) => s.platform)])
    const yearsOf = releases.length ? releases.map((r) => r.year) : t.jpYear ? [t.jpYear] : []

    // Bezugsquellen zählen wie Plattformen: Wer nach „maxdome" filtert, will
    // die Titel sehen, die es dort gibt — ob als Abo oder zum Kauf.
    const providersOf = new Set((t.watchLinks ?? []).map((w) => w.name))

    if (x.platforms.some((p) => platformsOf.has(p))) return false
    if (x.providers.some((p) => providersOf.has(p))) return false
    if (x.releaseTypes.some((rt) => releases.some((r) => r.releaseType === rt))) return false
    if (x.years.some((y) => yearsOf.includes(y))) return false
    if (x.statuses.includes(titleStatus(releases, today, t))) return false

    if (f.platforms.length && !f.platforms.some((p) => platformsOf.has(p))) return false
    if (f.providers.length && !f.providers.some((p) => providersOf.has(p))) return false
    if (f.releaseTypes.length && !releases.some((r) => f.releaseTypes.includes(r.releaseType))) return false
    if (f.years.length && !f.years.some((y) => yearsOf.includes(y))) return false
    if (f.statuses.length && !f.statuses.includes(titleStatus(releases, today, t))) return false
    if (f.search.trim() && !titleMatchesSearch(f.search.trim(), t)) return false
    return true
  })
}

export function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}
