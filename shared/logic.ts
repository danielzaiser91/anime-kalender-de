import type { Release, ReleaseEvent, ReleaseStatus, Title } from './types.ts'
import { addDays, todayIso } from './time.ts'

/**
 * Letzter Termin eines Releases im deutschen Dub.
 * Bei `weekly` aus Startdatum + Folgenzahl + Sendepausen berechnet,
 * sonst identisch mit dem Startdatum.
 */
export function lastEpisodeDate(release: Release): string | undefined {
  const s = release.schedule
  if (s.lastEpisodeDate) return s.lastEpisodeDate
  if (release.releaseType !== 'weekly') return s.firstEpisodeDate
  if (!s.episodeCount || s.episodeCount < 1) return undefined
  const skips = new Set(s.skipDates ?? [])
  let date = s.firstEpisodeDate
  let produced = 1
  let guard = 0
  while (produced < s.episodeCount && guard++ < 400) {
    date = addDays(date, 7)
    if (!skips.has(date)) produced++
  }
  return date
}

/**
 * Status nach Definition aus dem Auftrag:
 * airing         — heute liegt zwischen erster und letzter Dub-Folge
 * abgeschlossen  — letzte Dub-Folge liegt vor heute
 * tba            — erste Dub-Folge liegt in der Zukunft
 */
export function releaseStatus(release: Release, today = todayIso()): ReleaseStatus {
  const s = release.schedule
  if (!s?.firstEpisodeDate) return 'unbekannt'
  if (s.firstEpisodeDate > today) return 'tba'
  const last = lastEpisodeDate(release)
  if (!last) return 'airing'
  if (last < today) return 'abgeschlossen'
  return 'airing'
}

/**
 * Status eines Anime über alle seine Releases hinweg.
 * Läuft irgendetwas gerade, gewinnt „airing"; sonst zählt der nächste Termin.
 *
 * Ohne erfassten deutschen Termin hilft die japanische Ausstrahlung weiter:
 * Ist die längst vorbei und eine Synchro belegt, dann ist sie erschienen —
 * „Termin unbekannt" wäre für einen Titel von 2003 unsinnig.
 */
export function titleStatus(
  releases: Release[],
  today = todayIso(),
  title?: Pick<Title, 'jpEnd' | 'jpYear'>,
): ReleaseStatus {
  if (releases.length > 0) {
    const all = releases.map((r) => releaseStatus(r, today))
    if (all.includes('airing')) return 'airing'
    if (all.includes('tba')) return 'tba'
    if (all.includes('abgeschlossen')) return 'abgeschlossen'
  }
  const ended = title?.jpEnd ?? (title?.jpYear ? `${title.jpYear}-12-31` : undefined)
  if (ended && ended < today) return 'erschienen'
  return 'unbekannt'
}

/** Erzeugt aus der Termin-Regel eines Releases die einzelnen Kalender-Einträge. */
export function expandEvents(release: Release): ReleaseEvent[] {
  const s = release.schedule
  if (!s?.firstEpisodeDate) return []

  const base = {
    releaseSlug: release.slug,
    titleId: release.titleId,
    time: s.time,
    releaseType: release.releaseType,
    platform: release.platform,
    name: release.name,
    estimated: s.estimated,
  }

  if (release.releaseType !== 'weekly') {
    return [
      {
        ...base,
        id: `${release.slug}@${s.firstEpisodeDate}`,
        date: s.firstEpisodeDate,
        episodeCount: s.episodeCount,
      },
    ]
  }

  const count = s.episodeCount ?? 12
  const skips = new Set(s.skipDates ?? [])
  const events: ReleaseEvent[] = []
  let date = s.firstEpisodeDate
  let guard = 0
  while (events.length < count && guard++ < 400) {
    if (!skips.has(date)) {
      events.push({
        ...base,
        id: `${release.slug}@${date}`,
        date,
        episode: events.length + 1,
        episodeCount: count,
      })
    }
    date = addDays(date, 7)
  }
  return events
}
