/**
 * `lastmod` einer Titelseite in der Sitemap: das jüngste Datum, das die Daten des Titels selbst nennen.
 * Ein eigenes Änderungsdatum je Titel gibt es nicht (`gesehenAm` der Quellen ist fast überall der letzte Lauf).
 * Google nutzt `lastmod` nur, wo es stimmt — ohne belegtes Datum steht keines da, nie „heute“.
 */
import type { Release, Title } from '../../shared/types.ts'

const TAG = /^\d{4}-\d{2}-\d{2}$/

/** Die Tage, die der Titel und seine Termine als eigene Ereignisse nennen: Meldung der Quelle, Angebotsbeginn, Rücknahme, Ankündigung, Synchro-Stand. */
function ereignistage(t: Title, releases: Release[]): (string | undefined)[] {
  return [
    ...releases.flatMap((r) => (r.quellen ?? []).flatMap((q) => [q.aktualisiertAm, q.veroeffentlichtAm])),
    t.angebotSeit?.date,
    t.ankuendigung?.stand,
    ...(t.streams ?? []).map((s) => s.dubStand),
    ...(t.entfernteStreams ?? []).map((s) => s.entferntAm),
  ]
}

/** Jüngster Tag, der nicht nach `bis` (dem Tag des Baus) liegt; Termine in der Zukunft sind kein Änderungsdatum. */
export function titelAenderung(t: Title, releases: Release[], bis: string): string | undefined {
  const tage = ereignistage(t, releases).filter((d): d is string => typeof d === 'string' && TAG.test(d) && d <= bis)
  return tage.sort().at(-1)
}
