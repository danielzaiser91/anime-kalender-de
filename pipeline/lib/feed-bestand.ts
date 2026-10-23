import { buildIcs } from '../../shared/ics.ts'
import type { ReleaseEvent } from '../../shared/types.ts'
import { schneideFeed } from '../../worker/src/favoriten-feed-schnitt.ts'

/** Mehr Termine ab sieben Tage zurück sind ein Anlass, den Feed neu zu messen (23.10.2026: 518). */
export const MAX_TERMINE = 800
/** Grenze der Messung in Node mit Spielraum: Workers Free erlaubt 10 ms CPU, gemessen sind 0,6 ms; langsame Runner dürfen das Fünffache brauchen. */
export const MAX_MS = 50
export const FEED_NAME = 'Anime-Kalender DE – Meine Favoriten'
const SITE = 'https://anime-kalender.de/'

export interface Befund {
  name: string
  ok: boolean
  gefunden?: unknown
}

const median = (zahlen: number[]): number => [...zahlen].sort((a, b) => a - b)[Math.floor(zahlen.length / 2)]!

/** Median der Schnittzeit in ms über fünf Läufe. */
export function messeMs(alle: string, favoriten: Set<number>): number {
  const dauern: number[] = []
  for (let i = 0; i < 5; i++) {
    const start = performance.now()
    schneideFeed(alle, favoriten, FEED_NAME)
    dauern.push(performance.now() - start)
  }
  return median(dauern)
}

function gleichheitsFaelle(titel: number[], imFeed: ReleaseEvent[]): [string, number[]][] {
  const anzahl = (id: number): number => imFeed.filter((e) => e.titleId === id).length
  return [
    ['alle Titel', titel],
    ['jeder dritte Titel', titel.filter((_, i) => i % 3 === 0)],
    ['der terminreichste Titel', [[...titel].sort((a, b) => anzahl(b) - anzahl(a))[0]!]],
  ]
}

/** Die Zusicherungen zum Feed-Ausschnitt; `messe` liefert die Schnittzeit (im Test eingespeist). */
export function pruefeFeedBestand(
  alle: string,
  imFeed: ReleaseEvent[],
  messe: (alle: string, favoriten: Set<number>) => number,
): Befund[] {
  const titel = [...new Set(imFeed.map((e) => e.titleId))].sort((a, b) => a - b)
  const befunde: Befund[] = []
  for (const [name, ids] of gleichheitsFaelle(titel, imFeed)) {
    const erwartet = buildIcs(imFeed.filter((e) => ids.includes(e.titleId)), { siteUrl: SITE, calendarName: FEED_NAME })
    befunde.push({ name: `Bestand: Ausschnitt gleich buildIcs (${name}, ${ids.length} Titel)`, ok: schneideFeed(alle, new Set(ids), FEED_NAME) === erwartet })
  }
  const termine = alle.split('BEGIN:VEVENT').length - 1
  befunde.push({ name: `Bestand: all.ics führt höchstens ${MAX_TERMINE} Termine (jetzt ${termine})`, ok: termine > 0 && termine <= MAX_TERMINE, gefunden: termine })
  const ms = messe(alle, new Set(titel))
  befunde.push({ name: `Bestand: Ausschnitt mit allen ${titel.length} Titeln unter ${MAX_MS} ms (Median von 5: ${ms.toFixed(1)} ms)`, ok: ms < MAX_MS, gefunden: ms })
  return befunde
}
