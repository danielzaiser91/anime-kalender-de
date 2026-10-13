/**
 * **Katalog-Release** (13.10.2026, Daniel): Die ganze Staffel erscheint an ihrem Starttag auf einmal. Der Termin trägt `katalog`,
 * damit Seite, Kalender-Abo und Newsletter dasselbe sagen (wie `staffelfinale`). Zwei Wege führen dorthin:
 *  - ein `batch`-Release mit Erscheinungsdatum (nicht „im Angebot seit“) und belegter Zahl ab `KATALOG_MIN_FOLGEN` Folgen — ohne Zahl
 *    ist `batch` oft nur ein Starttermin aus einer Meldung (A Wild Last Boss Appeared! Staffel 2: Termin aus einer Simulcast-Übersicht);
 *  - ein wöchentlicher Release, dessen Folgen vom Start bis zum Finale (belegte Zahl) alle am Starttag liegen. Liegen sie später,
 *    ist es ein Wochentakt: Crunchyrolls Katalog stempelt bei laufenden Serien das Finale-Datum auf alle Folgen (The Beginning After the End).
 * `katalog: 'belegt'` steht nur mit ausdrücklichem Beleg (`data/katalog-release-von-hand.yaml`); sonst `'abgeleitet'` („Vermutlich …“).
 * „Im Angebot seit“ ist nie ein Katalog-Release: Ob die Folgen dort neu erschienen, sagt das Datum nicht.
 */
import type { Release, ReleaseEvent } from './types.ts'

/** Ab so vielen Folgen heißt „alles auf einmal“ Katalog-Release; zwei Folgen sind eine Doppelfolge. */
export const KATALOG_MIN_FOLGEN = 3

/** Kennung → Urteil der Handdatei: `belegt` (Quelle sagt „komplett“ oder alle Folgen beobachtet) oder `teil` (nur ein Teil der Staffel). */
export type KatalogBelege = ReadonlyMap<string, 'belegt' | 'teil'>

/* Das Feld hängt per Erweiterung am Termin: `shared/types.ts` liegt über der Dateigrenze und wächst nicht mehr. */
declare module './types.ts' {
  interface ReleaseEvent {
    /** Die ganze Staffel erscheint an diesem Tag auf einmal: ausdrücklich belegt oder nur abgeleitet (siehe `schreibeKatalogRelease`). */
    katalog?: 'belegt' | 'abgeleitet'
  }
}

/** Eine eigene Herkunft, die von einem Teil spricht („24 der 60 Folgen“, „die restlichen“), beschreibt keine ganze Staffel. */
const NUR_TEIL = /restlichen|\bTeil\b|\d+ der \d+/i

const mitErscheinungsdatum = (r: Release | undefined): r is Release =>
  !!r && r.dateMeaning !== 'available-from' && !r.widerlegt && !NUR_TEIL.test(r.herkunft ?? '')

function istBatchAmStueck(e: ReleaseEvent, r: Release | undefined): boolean {
  if (e.releaseType !== 'batch' || e.platform === 'tv' || e.sichtung || !mitErscheinungsdatum(r)) return false
  return !!e.episodeCount && e.episodeCount >= KATALOG_MIN_FOLGEN
}

/** Liegen Start und alle weiteren Folgen bis zum Finale (belegte Zahl) in dieser Gruppe am Starttag des Releases? */
function istStaffelAmStueck(tag: ReleaseEvent[], r: Release | undefined): boolean {
  const zahl = r?.schedule.episodeCount
  if (!mitErscheinungsdatum(r) || r.releaseType !== 'weekly' || r.schedule.episodeCountAssumed || !zahl) return false
  if (tag[0]!.date !== r.schedule.firstEpisodeDate) return false
  if (tag.some((e) => !e.episode || e.verpasst || e.sichtung)) return false
  const folgen = new Set(tag.map((e) => e.episode!))
  const start = r.schedule.firstEpisodeNumber ?? 1
  if (folgen.size < KATALOG_MIN_FOLGEN || folgen.size !== tag.length) return false
  for (let n = start; n <= zahl; n++) if (!folgen.has(n)) return false
  return folgen.size === zahl - start + 1
}

/** Setzt `katalog` an die betroffenen Termine; liefert deren Zahl. Ein Release, den die Handdatei als Teil führt, bleibt außen vor. */
export function schreibeKatalogRelease(events: ReleaseEvent[], releases: Release[], belege: KatalogBelege): number {
  const releaseBySlug = new Map(releases.map((r) => [r.slug, r]))
  const jeTag = new Map<string, ReleaseEvent[]>()
  for (const e of events) {
    const schluessel = `${e.releaseSlug}|${e.date}`
    jeTag.set(schluessel, [...(jeTag.get(schluessel) ?? []), e])
  }
  let anzahl = 0
  for (const tag of jeTag.values()) {
    const slug = tag[0]!.releaseSlug
    const r = releaseBySlug.get(slug)
    if (belege.get(slug) === 'teil') continue
    if (!tag.every((e) => istBatchAmStueck(e, r)) && !istStaffelAmStueck(tag, r)) continue
    for (const e of tag) e.katalog = belege.get(slug) === 'belegt' ? 'belegt' : 'abgeleitet'
    anzahl += tag.length
  }
  return anzahl
}
