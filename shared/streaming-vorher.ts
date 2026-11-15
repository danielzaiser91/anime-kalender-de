/**
 * **Streaming vorher** (15.11.2026): Ein Disc-Termin trägt, bei welchem Streaming-Anbieter die deutsche Fassung des Titels
 * schon vorher lief. Ohne belegten früheren Streaming-Termin steht nichts da („erstmals“ wäre unbelegt). Eigenes Feld statt
 * `zweitanbieter`: das treibt Filter der Seite und behält seine Bedeutung. Gerechnet wird im Bau, damit die ICS-Datei es sagt.
 */
import type { PlatformId, Release, ReleaseEvent } from './types.ts'
import { anbieterVon, istStreaming } from './zweitanbieter.ts'

/** Der früheste belegte Streaming-Termin; `mindestens` bei „Im Angebot seit“ (Katalogdatum). */
export interface StreamingVorher {
  anbieter: PlatformId
  seit: string
  mindestens?: true
}

declare module './types.ts' {
  interface ReleaseEvent {
    /** Die deutsche Fassung lief schon vor dieser Disc bei einem Streaming-Anbieter. */
    streamingVorher?: StreamingVorher
  }
}

/** Setzt `streamingVorher` an Disc-Termine mit früherem, nicht geschätztem Streaming-Termin; liefert deren Zahl. */
export function schreibeStreamingVorher(events: ReleaseEvent[], releases: Release[], kanalAnbieter: ReadonlyMap<number, PlatformId>): number {
  const anbieter = anbieterVon(releases, kanalAnbieter)
  const katalog = new Set(releases.filter((r) => r.dateMeaning === 'available-from').map((r) => r.slug))
  const fruehest = new Map<number, ReleaseEvent>()
  for (const e of events) {
    /* Geschätzte Tage und OmU/„Synchro offen“ belegen keine deutsche Fassung zu diesem Tag. */
    if (!istStreaming(e) || e.estimated || e.sprache) continue
    const f = fruehest.get(e.titleId)
    if (!f || e.date < f.date) fruehest.set(e.titleId, e)
  }
  let anzahl = 0
  for (const e of events) {
    const f = e.releaseType === 'disc' && !e.sprache ? fruehest.get(e.titleId) : undefined
    if (!f || f.date >= e.date) continue
    e.streamingVorher = { anbieter: anbieter(f), seit: f.date, ...(katalog.has(f.releaseSlug) && { mindestens: true as const }) }
    anzahl++
  }
  return anzahl
}
