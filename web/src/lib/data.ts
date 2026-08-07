import type { DataMeta, Release, ReleaseEvent, Title } from '@shared/types.ts'

export interface Dataset {
  titles: Title[]
  titleById: Map<number, Title>
  releases: Release[]
  releaseBySlug: Map<string, Release>
  events: ReleaseEvent[]
  eventsByDate: Map<string, ReleaseEvent[]>
  releasesByTitle: Map<number, Release[]>
  meta: DataMeta
}

function url(path: string): string {
  return `${import.meta.env.BASE_URL}data/${path}`
}

async function loadJson<T>(path: string): Promise<T> {
  const res = await fetch(url(path))
  if (!res.ok) throw new Error(`${path} konnte nicht geladen werden (${res.status})`)
  return (await res.json()) as T
}

export async function loadDataset(): Promise<Dataset> {
  const [titles, releases, events, meta] = await Promise.all([
    loadJson<Title[]>('titles-core.json'),
    loadJson<Release[]>('releases.json'),
    loadJson<ReleaseEvent[]>('events.json'),
    loadJson<DataMeta>('meta.json'),
  ])

  const titleById = new Map(titles.map((t) => [t.id, t]))
  const releaseBySlug = new Map(releases.map((r) => [r.slug, r]))

  const eventsByDate = new Map<string, ReleaseEvent[]>()
  for (const ev of events) {
    const list = eventsByDate.get(ev.date)
    if (list) list.push(ev)
    else eventsByDate.set(ev.date, [ev])
  }

  const releasesByTitle = new Map<number, Release[]>()
  for (const r of releases) {
    const list = releasesByTitle.get(r.titleId)
    if (list) list.push(r)
    else releasesByTitle.set(r.titleId, [r])
  }

  return { titles, titleById, releases, releaseBySlug, events, eventsByDate, releasesByTitle, meta }
}

let allTitlesPromise: Promise<Title[]> | undefined

/**
 * Vollständige Titelliste — mehrere Megabyte, deshalb erst beim Öffnen der
 * Datenbank-Ansicht. Die geladenen Titel wandern in den bestehenden Index,
 * damit das Detail-Panel sie danach ohne weiteren Abruf findet.
 */
export function loadAllTitles(data: Dataset): Promise<Title[]> {
  allTitlesPromise ??= loadJson<Title[]>('titles.json').then((titles) => {
    for (const t of titles) {
      const existing = data.titleById.get(t.id)
      // Kuratierte Ergänzungen aus dem Kern-Datensatz nicht überschreiben.
      data.titleById.set(t.id, existing ? { ...t, ...existing } : t)
    }
    return titles.map((t) => data.titleById.get(t.id)!)
  })
  return allTitlesPromise
}

/** Handlung je Sprache. Deutsch stammt von TMDB, Englisch von AniList. */
export interface Synopsis {
  de?: string
  en?: string
}

let synopsisCache: Record<number, Synopsis> | undefined
let synopsisPromise: Promise<Record<number, Synopsis>> | undefined

/** Synopsen liegen in einer eigenen Datei und werden erst beim ersten Detail-Öffnen geholt. */
export async function loadSynopses(): Promise<Record<number, Synopsis>> {
  if (synopsisCache) return synopsisCache
  synopsisPromise ??= loadJson<Record<number, Synopsis>>('synopses.json').then((data) => {
    synopsisCache = data
    return data
  })
  return synopsisPromise
}

export function feedUrl(name: string): string {
  return `${import.meta.env.BASE_URL}data/feeds/${name}`
}

/** Absolute URL — Google Calendar und Outlook brauchen sie zum Abonnieren. */
export function absoluteFeedUrl(name: string): string {
  return new URL(feedUrl(name), window.location.href).toString()
}
