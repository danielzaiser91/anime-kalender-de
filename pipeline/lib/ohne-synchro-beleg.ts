/**
 * **Ein Termin ohne belegte deutsche Synchro steht nicht im Kalender** (Daniel, 18.10.2026, Dragon Ball Super: Beerus:
 * „so eine Hoffnung darf niemals mehr im Kalender stehen“).
 *
 * `Release.sprache` (`omu` = Quelle nennt nur Originalton, `offen` = Sprache nicht angegeben) bleibt am Release; der Titel, seine
 * Angaben und die Detailseite („nur OmU, Synchro nicht angekündigt“) bleiben erhalten. Nur das Ereignis entfällt, und damit
 * Kalenderansicht, Abo-Feeds, Wochen-Datei und Newsletter. Das Kennzeichen am Release ist die Grundlage für eine spätere Wackelkandidaten-Liste.
 */
import { expandEvents } from '../../shared/logic.ts'
import type { Release, ReleaseEvent } from '../../shared/types.ts'

/** Erlaubt nur Ereignisse, deren Release keine Sprachkennzeichnung (omu/offen) trägt. */
export const mitBelegterSynchro = (e: Pick<ReleaseEvent, 'sprache'>): boolean => !e.sprache

/** Die Ereignisse eines Releases, die in den Kalender dürfen (keins, wenn es `sprache` trägt). */
export const kalenderTermine = (r: Release): ReleaseEvent[] => expandEvents(r).filter(mitBelegterSynchro)

/** Die „Im Angebot seit“-Releases, die einen Kalendertermin haben müssen (ohne `sprache`, ohne widerlegte), und davon die Slugs ohne Termin. */
export function katalogReleasesOhneTermin(releases: Release[], termine: ReleaseEvent[]): { katalog: Release[]; ohneTermin: string[] } {
  const katalog = releases.filter((r) => r.dateMeaning === 'available-from' && !r.widerlegt && r.schedule?.firstEpisodeDate && mitBelegterSynchro(r))
  const mitTermin = new Set(termine.map((e) => e.releaseSlug))
  return { katalog, ohneTermin: katalog.filter((r) => !mitTermin.has(r.slug)).map((r) => r.slug) }
}

/** Fehler für jedes Ereignis mit Sprachkennzeichnung (Endkontrolle vor dem Schreiben). */
export function termineOhneBelegteSynchro(events: ReleaseEvent[]): string[] {
  return events.filter((e) => !mitBelegterSynchro(e)).map((e) => `"${e.id}": Termin mit Sprache „${e.sprache}“ steht im Kalender — ohne belegte Synchro nicht erlaubt`)
}
