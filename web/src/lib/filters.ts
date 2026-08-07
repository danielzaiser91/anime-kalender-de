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

export interface FilterState {
  platforms: PlatformId[]
  releaseTypes: ReleaseType[]
  statuses: ReleaseStatus[]
  fsk: Fsk[]
  years: number[]
  genres: string[]
  keywords: string[]
  search: string
  /** Blendet Termine aus, die nur abgeleitet sind. */
  confirmedOnly: boolean
  /** Mindest-Vertrauensstufe der Dub-Angabe (nur Datenbank-Ansicht). */
  minConfidence: DubConfidence
}

export const EMPTY_FILTERS: FilterState = {
  platforms: [],
  releaseTypes: [],
  statuses: [],
  fsk: [],
  years: [],
  genres: [],
  keywords: [],
  search: '',
  confirmedOnly: false,
  minConfidence: 'low',
}

const CONFIDENCE_RANK: Record<DubConfidence, number> = {
  low: 0,
  normal: 1,
  high: 2,
  'very-high': 3,
}

export function isFilterActive(f: FilterState): boolean {
  return (
    f.platforms.length > 0 ||
    f.releaseTypes.length > 0 ||
    f.statuses.length > 0 ||
    f.fsk.length > 0 ||
    f.years.length > 0 ||
    f.genres.length > 0 ||
    f.keywords.length > 0 ||
    f.search.trim() !== '' ||
    f.confirmedOnly ||
    f.minConfidence !== 'low'
  )
}

export function activeFilterCount(f: FilterState): number {
  return (
    f.platforms.length +
    f.releaseTypes.length +
    f.statuses.length +
    f.fsk.length +
    f.years.length +
    f.genres.length +
    f.keywords.length +
    (f.search.trim() ? 1 : 0) +
    (f.confirmedOnly ? 1 : 0) +
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
  if (f.platforms.length && !f.platforms.includes(release.platform)) return false
  if (f.releaseTypes.length && !f.releaseTypes.includes(release.releaseType)) return false
  if (f.years.length && !f.years.includes(release.year)) return false
  if (f.confirmedOnly && release.schedule.estimated) return false

  if (f.fsk.length) {
    if (release.fsk === undefined) return false
    if (!f.fsk.includes(release.fsk)) return false
  }
  if (f.statuses.length && !f.statuses.includes(releaseStatus(release, today))) return false

  if (f.genres.length) {
    const genres = title?.genres ?? []
    if (!f.genres.every((g) => genres.includes(g))) return false
  }
  if (f.keywords.length) {
    const keywords = title?.keywords ?? []
    if (!f.keywords.every((k) => keywords.includes(k))) return false
  }
  if (f.search.trim() && !matchesSearch(f.search.trim(), release, title)) return false
  return true
}

export function filterEvents(
  data: Dataset,
  f: FilterState,
  today: string,
): ReleaseEvent[] {
  const allowed = new Set(
    data.releases
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
): Title[] {
  return source.filter((t) => {
    if (CONFIDENCE_RANK[t.dubConfidence] < CONFIDENCE_RANK[f.minConfidence]) return false
    if (f.genres.length && !f.genres.every((g) => t.genres.includes(g))) return false
    if (f.keywords.length && !f.keywords.every((k) => t.keywords.includes(k))) return false
    if (f.fsk.length && (t.fsk === undefined || !f.fsk.includes(t.fsk))) return false

    const releases = data.releasesByTitle.get(t.id) ?? []

    if (f.platforms.length) {
      const platforms = new Set([...releases.map((r) => r.platform), ...t.streams.map((s) => s.platform)])
      if (!f.platforms.some((p) => platforms.has(p))) return false
    }
    if (f.releaseTypes.length && !releases.some((r) => f.releaseTypes.includes(r.releaseType))) return false
    if (f.years.length) {
      const years = releases.length ? releases.map((r) => r.year) : t.jpYear ? [t.jpYear] : []
      if (!f.years.some((y) => years.includes(y))) return false
    }
    if (f.statuses.length && !f.statuses.includes(titleStatus(releases, today))) return false
    if (f.search.trim() && !titleMatchesSearch(f.search.trim(), t)) return false
    return true
  })
}

export function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}
