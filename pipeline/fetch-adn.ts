/**
 * Liest den Veröffentlichungskalender von ADN (Animation Digital Network).
 *
 * Warum das die zweitbeste Quelle nach Crunchyroll ist: ADN betreibt eine
 * öffentliche JSON-Schnittstelle, die je Folge **Datum, Uhrzeit und
 * Sprachfassung** nennt. Der Sprachcode ist dabei das Entscheidende:
 *
 *   vde    — deutsche Synchronfassung
 *   vostde — japanischer Ton mit deutschen Untertiteln
 *
 * Damit beantwortet ADN von sich aus genau die Frage, für die es sonst keine
 * maschinenlesbare Antwort gibt: Gibt es eine deutsche Synchro, und wann läuft
 * sie? Kein Schätzen, kein Ableiten. Alles ohne `vde` ignorieren wir.
 *
 * Ein Aufruf je Tag, mit Pause dazwischen. Die Schnittstelle ist dieselbe, die
 * auch die Webseite benutzt; ein Schlüssel ist nicht nötig.
 *
 * Aufruf: npx tsx pipeline/fetch-adn.ts [--from -30] [--to 60]
 */
import { addDays, diffDays, todayIso } from '../shared/time.ts'
import { log, sleep, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'

const API = 'https://gw.api.animationdigitalnetwork.com/video/calendar'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'

const args = process.argv.slice(2)
const numberArg = (name: string, fallback: number) => {
  const index = args.indexOf(name)
  return index >= 0 ? Number(args[index + 1]) : fallback
}
const FROM = numberArg('--from', -45)
const TO = numberArg('--to', 75)

interface AdnVideo {
  id: number
  number: string | null
  shortNumber: string | null
  releaseDate: string
  languages: string[]
  url: string
  show: { id: number; title: string; originalTitle: string | null; age: string | null; url?: string }
}

export interface AdnEpisode {
  /** ISO-Datum in Europe/Berlin. */
  date: string
  /** "HH:MM" in Europe/Berlin. */
  time: string
  episode?: number
  url: string
}

export interface AdnShow {
  showId: number
  title: string
  originalTitle?: string
  /** Altersfreigabe, wie ADN sie schreibt ("12+"). */
  age?: string
  url: string
  episodes: AdnEpisode[]
  /**
   * true, wenn alle bekannten Folgen auf denselben Termin fallen — ADN
   * veröffentlicht Katalogtitel als Komplettabwurf, Simulcasts wöchentlich.
   */
  batch: boolean
}

export interface AdnData {
  scrapedAt: string
  window: { from: string; to: string }
  shows: AdnShow[]
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

function toBerlin(iso: string): { date: string; time: string } | undefined {
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return undefined
  const parts = berlin.formatToParts(dt)
  const get = (type: string) => parts.find((p) => p.type === type)!.value
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour') === '24' ? '00' : get('hour')}:${get('minute')}`,
  }
}

async function fetchDay(date: string): Promise<AdnVideo[]> {
  const res = await fetch(`${API}?date=${date}`, {
    headers: { 'User-Agent': UA, 'X-Target-Distribution': 'de', Accept: 'application/json' },
  })
  if (!res.ok) {
    warn(`ADN ${date}: HTTP ${res.status}`)
    return []
  }
  const body = (await res.json()) as { videos?: AdnVideo[] }
  return body.videos ?? []
}

async function main(): Promise<void> {
  const today = todayIso()
  const from = addDays(today, FROM)
  const to = addDays(today, TO)

  const byShow = new Map<number, AdnShow>()
  let days = 0
  let dubbed = 0

  for (let date = from; date <= to; date = addDays(date, 1)) {
    let videos: AdnVideo[]
    try {
      videos = await fetchDay(date)
    } catch (err) {
      warn(`ADN ${date}: ${(err as Error).message}`)
      continue
    }
    days++

    for (const video of videos) {
      // Nur die deutsche Synchronfassung. Untertitel sind für diesen Kalender
      // keine deutsche Veröffentlichung.
      if (!video.languages?.includes('vde')) continue
      dubbed++
      const when = toBerlin(video.releaseDate)
      if (!when) continue

      const show = byShow.get(video.show.id) ?? {
        showId: video.show.id,
        title: video.show.title,
        originalTitle: video.show.originalTitle ?? undefined,
        age: video.show.age ?? undefined,
        url: `https://animationdigitalnetwork.com/de/video/${video.show.id}`,
        episodes: [],
        batch: false,
      }
      const number = Number(video.shortNumber ?? video.number?.replace(/\D+/g, ''))
      show.episodes.push({
        date: when.date,
        time: when.time,
        episode: Number.isFinite(number) && number > 0 ? number : undefined,
        url: video.url,
      })
      byShow.set(video.show.id, show)
    }
    await sleep(220)
  }

  if (!days) {
    recordSource('adn', 0, 'kein einziger Tag abrufbar')
    warn('ADN nicht erreichbar — Bestand bleibt unangetastet.')
    return
  }
  recordSource('adn', byShow.size, byShow.size ? undefined : 'keine Folge mit vde gefunden')

  const shows = [...byShow.values()].map((show) => {
    show.episodes.sort((a, b) => a.date.localeCompare(b.date) || (a.episode ?? 0) - (b.episode ?? 0))
    const dates = new Set(show.episodes.map((e) => e.date))
    return { ...show, batch: dates.size === 1 && show.episodes.length > 1 }
  })

  writeJson('data/adn.json', { scrapedAt: new Date().toISOString(), window: { from, to }, shows } satisfies AdnData, true)

  log(`ADN: ${days} Tage geprüft, ${dubbed} Folgen mit deutscher Synchro, ${shows.length} Serien`)
  for (const show of shows) {
    const first = show.episodes[0]
    const span = show.episodes.length > 1 ? diffDays(first.date, show.episodes.at(-1)!.date) : 0
    log(
      `  · ${show.title} — ${show.batch ? 'Komplettabwurf' : 'wöchentlich'}, ` +
        `ab ${first.date} ${first.time}, ${show.episodes.length} Folgen${span ? ` über ${span} Tage` : ''}`,
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
