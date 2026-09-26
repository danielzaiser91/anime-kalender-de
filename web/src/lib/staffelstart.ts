import type { Release, ReleaseEvent } from '@shared/types.ts'

/**
 * Beginnt an diesem Termin die deutsche Synchro einer Staffel (oder eines geteilten Teils)?
 *
 * Nur bei wöchentlichen Releases: Ein Katalogtitel mit `available-from` ist „im Angebot seit",
 * nicht „erschienen am", und eine Fernsehausstrahlung beantwortet `tvPremiere()`. Gezählt wird
 * nach der Nummer, nicht nach der Position — ein geteilter Start beginnt bei `firstEpisodeNumber`.
 */
export function istStaffelstart(e: ReleaseEvent, data: { releaseBySlug: Map<string, Release> }): boolean {
  if (e.platform === 'tv' || e.sichtung || !e.episode || e.releaseType !== 'weekly') return false
  const release = data.releaseBySlug.get(e.releaseSlug)
  if (!release || release.dateMeaning === 'available-from') return false
  return e.episode === (release.schedule?.firstEpisodeNumber ?? 1)
}
