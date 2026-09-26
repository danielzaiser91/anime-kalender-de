import type { Release, ReleaseEvent } from '@shared/types.ts'

type MitReleases = { releaseBySlug: Map<string, Release> }

/** Der wöchentliche Streaming-Release eines Termins — nur für ihn gibt es Start und Finale. */
function woechentlich(e: ReleaseEvent, data: MitReleases): Release | undefined {
  if (e.platform === 'tv' || e.sichtung || !e.episode || e.releaseType !== 'weekly') return undefined
  const release = data.releaseBySlug.get(e.releaseSlug)
  return release && release.dateMeaning !== 'available-from' ? release : undefined
}

/**
 * Beginnt an diesem Termin die deutsche Synchro einer Staffel (oder eines geteilten Teils)?
 *
 * Nur bei wöchentlichen Releases: Ein Katalogtitel mit `available-from` ist „im Angebot seit",
 * nicht „erschienen am", und eine Fernsehausstrahlung beantwortet `tvPremiere()`. Gezählt wird
 * nach der Nummer, nicht nach der Position — ein geteilter Start beginnt bei `firstEpisodeNumber`.
 */
export function istStaffelstart(e: ReleaseEvent, data: MitReleases): boolean {
  const release = woechentlich(e, data)
  return !!release && e.episode === (release.schedule?.firstEpisodeNumber ?? 1)
}

/**
 * Endet an diesem Termin die Staffel? Nur mit belegter Folgenzahl — eine geratene
 * (`episodeCountAssumed`) macht aus der letzten bekannten Folge kein Finale.
 */
export function istStaffelfinale(e: ReleaseEvent, data: MitReleases): boolean {
  const release = woechentlich(e, data)
  if (!release || release.schedule?.episodeCountAssumed) return false
  return !!e.episodeCount && e.episode === e.episodeCount
}
