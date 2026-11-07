import type { Release } from '../../shared/types.ts'

/** Kennungen der Releases ohne Quelle: `sources` fehlt, ist kein Array oder leer. */
export function releasesOhneQuelle(releases: Release[]): string[] {
  return releases.filter((r) => !Array.isArray(r.sources) || !r.sources.length).map((r) => r.slug)
}
