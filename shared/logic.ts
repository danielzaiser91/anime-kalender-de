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
/**
 * Wie lange nach dem japanischen Ende eine deutsche Fassung als „erschienen"
 * gilt, wenn kein Termin bekannt ist.
 *
 * Der Status stützt sich auf einen Schluss, der bei alten Katalogtiteln trägt:
 * Cowboy Bebop lief 1998, es gibt eine deutsche Fassung, also ist sie längst
 * draußen — nur das Datum kennen wir nicht. Bei einer Serie, die vor fünf
 * Wochen in Japan endete, trägt derselbe Schluss nicht mehr.
 *
 * Real am 10.08.2026: „Mushoku Tensei Staffel 3" (japanisches Ende 04.07.2026)
 * stand auf der Seite mit „Die deutsche Fassung ist erschienen." Es gibt sie
 * nicht, nicht einmal die erste Folge. 96 Titel trugen dieselbe Behauptung.
 *
 * Ein Jahr ist bewusst großzügig: Eine Synchro entsteht nicht über Nacht, und
 * wer im letzten Jahr lief und bei uns keinen Termin hat, ist entweder noch
 * nicht vertont oder von uns nicht erfasst. In beiden Fällen ist „unbekannt"
 * die ehrliche Antwort.
 */
const ERSCHIENEN_MINDESTABSTAND_TAGE = 365

export function titleStatus(
  releases: Release[],
  today = todayIso(),
  title?: Pick<Title, 'jpEnd' | 'jpYear' | 'dubConfidence'>,
): ReleaseStatus {
  if (releases.length > 0) {
    const all = releases.map((r) => releaseStatus(r, today))
    if (all.includes('airing')) return 'airing'
    if (all.includes('tba')) return 'tba'
    if (all.includes('abgeschlossen')) return 'abgeschlossen'
  }
  const ended = title?.jpEnd ?? (title?.jpYear ? `${title.jpYear}-12-31` : undefined)
  // Eine einzige Quelle reicht für eine Terminangabe nicht — und erst recht
  // nicht für den Satz „die deutsche Fassung ist erschienen".
  if (ended && title?.dubConfidence !== 'low' && ended < addDays(today, -ERSCHIENEN_MINDESTABSTAND_TAGE)) {
    return 'erschienen'
  }
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

  /**
   * Bei welcher Folgennummer dieses Release einsetzt — und bis zu welcher die
   * Reihe insgesamt läuft. Beides fällt nur dann zusammen, wenn ein Release
   * die ganze Staffel abdeckt; bei einem geteilten Start (siehe
   * `firstEpisodeNumber`) beginnt der zweite Teil mitten in der Zählung.
   */
  const first = Math.max(1, s.firstEpisodeNumber ?? 1)
  const last = first + count - 1

  /**
   * Beobachtete Folgen, aufsteigend. Sie sind die Stützpunkte des Sendeplans:
   * Jede Folge rechnet ab der jüngsten Beobachtung **vor** ihr weiter.
   *
   * Der Unterschied ist keine Kleinigkeit. Vorher lief die Rechnung stur ab
   * Folge 1 durch, und eine einzige Sendepause verschob alles Weitere um eine
   * Woche: Bei „Ascendance of a Bookworm" pausierte die Staffel am 25.07., die
   * echte Folge 14 lief am 08.08. — der Kalender setzte dorthin Folge 15 und
   * behauptete damit eine deutsche Fassung, die es noch gar nicht gab.
   *
   * Ein Stützpunkt hinter sich zu haben heißt: Der Takt ab dort ist gemessen,
   * nicht geraten. Alles jenseits der letzten Beobachtung bleibt Fortschreibung
   * und wird als solche gekennzeichnet.
   */
  const anchors = Object.entries(s.observed ?? {})
    .map(([episode, date]) => ({ episode: Number(episode), date }))
    .filter((a) => a.episode > 0 && a.date)
    .sort((a, b) => a.episode - b.episode)
  const lastAnchor = anchors[anchors.length - 1]

  const dateOf = (episode: number): string => {
    let anchor: { episode: number; date: string } | undefined
    for (const candidate of anchors) {
      if (candidate.episode > episode) break
      anchor = candidate
    }
    return anchor
      ? addDays(anchor.date, 7 * (episode - anchor.episode))
      : addDays(s.firstEpisodeDate, 7 * (episode - first))
  }

  const events: ReleaseEvent[] = []
  for (let episode = first; episode <= last; episode++) {
    const date = dateOf(episode)
    if (skips.has(date)) continue
    events.push({
      ...base,
      id: `${release.slug}@${date}`,
      date,
      episode,
      episodeCount: last,
      // Gesehen ist gesehen; fortgeschrieben bleibt eine Annahme, auch wenn
      // der Start selbst belegt ist.
      estimated: s.observed?.[episode] ? undefined : lastAnchor ? true : s.estimated,
    })
  }
  return events
}
