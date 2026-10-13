/**
 * **Katalog-Release** (13.10.2026, Daniel): Die ganze Staffel erscheint an einem Tag. Der Termin trägt `katalog`, damit Seite,
 * Kalender-Abo und Newsletter dasselbe sagen (wie `staffelfinale`). Zwei Wege führen dorthin:
 *  - ein `batch`-Release mit Erscheinungsdatum (nicht „im Angebot seit“) und belegter Zahl ab `KATALOG_MIN_FOLGEN` Folgen — ohne Zahl
 *    ist `batch` oft nur ein Starttermin aus einer Meldung (A Wild Last Boss Appeared! Staffel 2: Termin aus einer Simulcast-Übersicht);
 *  - ein wöchentlicher Release, dessen Folgen vom Start bis zum Finale (belegte Zahl) alle am selben Tag liegen.
 * „Im Angebot seit“ ist nie ein Katalog-Release: Ob die Folgen dort neu erschienen, sagt das Datum nicht.
 */
import type { Release, ReleaseEvent } from './types.ts'

/** Ab so vielen Folgen heißt „alles auf einmal“ Katalog-Release; zwei Folgen sind eine Doppelfolge. */
export const KATALOG_MIN_FOLGEN = 3

/* Das Feld hängt per Erweiterung am Termin: `shared/types.ts` liegt über der Dateigrenze und wächst nicht mehr. */
declare module './types.ts' {
  interface ReleaseEvent {
    /** Die ganze Staffel erscheint an diesem Tag auf einmal (siehe `schreibeKatalogRelease`). */
    katalog?: boolean
  }
}

const mitErscheinungsdatum = (r: Release | undefined): r is Release => !!r && r.dateMeaning !== 'available-from' && !r.widerlegt

function istBatchAmStueck(e: ReleaseEvent, r: Release | undefined): boolean {
  if (e.releaseType !== 'batch' || e.platform === 'tv' || e.sichtung || !mitErscheinungsdatum(r)) return false
  return !!e.episodeCount && e.episodeCount >= KATALOG_MIN_FOLGEN
}

/** Liegen Start und alle weiteren Folgen bis zum Finale (belegte Zahl) in dieser Gruppe eines Tages? */
function istStaffelAmStueck(tag: ReleaseEvent[], r: Release | undefined): boolean {
  const zahl = r?.schedule.episodeCount
  if (!mitErscheinungsdatum(r) || r.releaseType !== 'weekly' || r.schedule.episodeCountAssumed || !zahl) return false
  if (tag.some((e) => !e.episode || e.verpasst || e.sichtung)) return false
  const folgen = new Set(tag.map((e) => e.episode!))
  const start = r.schedule.firstEpisodeNumber ?? 1
  if (folgen.size < KATALOG_MIN_FOLGEN || folgen.size !== tag.length) return false
  for (let n = start; n <= zahl; n++) if (!folgen.has(n)) return false
  return folgen.size === zahl - start + 1
}

/** Setzt `katalog` an die betroffenen Termine; liefert deren Zahl. */
export function schreibeKatalogRelease(events: ReleaseEvent[], releases: Release[]): number {
  const releaseBySlug = new Map(releases.map((r) => [r.slug, r]))
  const jeTag = new Map<string, ReleaseEvent[]>()
  for (const e of events) {
    const schluessel = `${e.releaseSlug}|${e.date}`
    jeTag.set(schluessel, [...(jeTag.get(schluessel) ?? []), e])
  }
  let anzahl = 0
  for (const tag of jeTag.values()) {
    const r = releaseBySlug.get(tag[0]!.releaseSlug)
    if (!tag.every((e) => istBatchAmStueck(e, r)) && !istStaffelAmStueck(tag, r)) continue
    for (const e of tag) e.katalog = true
    anzahl += tag.length
  }
  return anzahl
}
