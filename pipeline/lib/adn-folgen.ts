/**
 * Folgen aus ADN-Antworten: Rohform der Schnittstelle und ihre Übersetzung in unseren Folgeneintrag.
 * Aus `fetch-adn.ts` herausgelöst, damit Sammelläufe und Prüfungen es teilen (jene Datei startet beim Laden ihr `main()`).
 */
import { bestimmeRhythmus, type AdnEpisode, type AdnShow } from './adn.ts'

export interface AdnVideo {
  id: number
  title?: string | null
  /** Folgentitel, oft französisch oder leer. */
  name?: string | null
  number: string | null
  shortNumber: string | null
  /** Staffel, wie ADN sie zählt: "1", "2", "3". */
  season?: string | null
  /** Kennung samt Staffel und Folge: "swordartonline_tv3_0047". */
  reference?: string | null
  /** Laufende Nummer über die gesamte Serie hinweg. */
  order?: number | null
  /** "EPS" (Folge), "OAV", "FLM" … */
  type?: string | null
  /** Laufzeit in Sekunden. */
  duration?: number | null
  image?: string | null
  releaseDate: string
  languages: string[]
  url: string
  show: { id: number; title: string; originalTitle: string | null; age: string | null; url?: string }
}

/**
 * Baut aus einem ADN-Video unseren Folgeneintrag — an einer Stelle, damit
 * Kalender- und Katalogweg nicht auseinanderlaufen.
 *
 * Genau das war vorher der Fall: Beide Wege bauten das Objekt von Hand, und
 * beide vergaßen dieselben Felder.
 */
export function episodeAus(video: AdnVideo, when: { date: string; time: string }): AdnEpisode {
  const nummer = Number(video.shortNumber ?? video.number?.replace(/\D+/g, ''))
  return {
    date: when.date,
    time: when.time,
    episode: Number.isFinite(nummer) && nummer > 0 ? nummer : undefined,
    url: video.url,
    season: video.season ?? undefined,
    // Die Folgennummer am Ende abschneiden: "swordartonline_tv3_0047" →
    // "swordartonline_tv3".
    seasonReference: video.reference?.replace(/_\d+$/, '') || undefined,
    order: typeof video.order === 'number' ? video.order : undefined,
    type: video.type ?? undefined,
    duration: typeof video.duration === 'number' ? video.duration : undefined,
    title: video.name || video.title || undefined,
    image: video.image ?? undefined,
  }
}

const berlin = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export function toBerlin(iso: string): { date: string; time: string } | undefined {
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return undefined
  const parts = berlin.formatToParts(dt)
  const get = (type: string) => parts.find((p) => p.type === type)!.value
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour') === '24' ? '00' : get('hour')}:${get('minute')}`,
  }
}

/** Ordnet Folgen nach Staffel, dann Nummer, dann Termin. */
export function sortiereFolgen(episodes: AdnEpisode[]): void {
  episodes.sort(
    (a, b) =>
      (a.season ?? '').localeCompare(b.season ?? '') ||
      (a.order ?? 0) - (b.order ?? 0) ||
      a.date.localeCompare(b.date) ||
      (a.episode ?? 0) - (b.episode ?? 0),
  )
}


/** Ein Eintrag der Serienliste von ADN (`/show`), soweit wir ihn brauchen. */
export interface AdnListenEintrag {
  id: number
  title: string
  originalTitle?: string | null
  age?: string | null
}

/** Die Serie als Katalogeintrag mit ihren deutschen Folgen (`vde`); ohne eine solche Folge gibt es keinen Eintrag. */
export function katalogShowAus(eintrag: AdnListenEintrag, videos: AdnVideo[]): AdnShow | undefined {
  const episodes: AdnEpisode[] = []
  for (const v of videos.filter((v) => v.languages?.includes('vde'))) {
    const when = toBerlin(v.releaseDate)
    if (when) episodes.push(episodeAus(v, when))
  }
  if (!episodes.length) return undefined
  sortiereFolgen(episodes)
  return {
    showId: eintrag.id,
    title: eintrag.title,
    originalTitle: eintrag.originalTitle ?? undefined,
    age: eintrag.age ?? undefined,
    url: `https://animationdigitalnetwork.com/de/video/${eintrag.id}`,
    episodes,
    batch: bestimmeRhythmus(episodes) !== 'weekly' && episodes.length > 1,
    fromCatalog: true,
  }
}
