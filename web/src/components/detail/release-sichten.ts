import { useMemo } from 'react'
import type { Release } from '@shared/types.ts'
import { addDays } from '@shared/time.ts'

/**
 * Drei Sichten auf die Releases eines Titels für das Panel.
 *
 * - `discReleases`: Jedes Release ist ein Bezugsweg; eine Disc gehört zu den Kaufwegen.
 * - `releaseJePlattform`: ein Anbieter, eine Pille — das Datum hängt an der Pille, die es betrifft.
 * - `kinoRelease`: steht im Banner, solange er läuft (belegter letzter Spieltag) oder bevorsteht,
 *   ohne belegtes Ende bis 60 Tage nach dem Start (17.09.2026).
 */
export function useReleaseSichten(releases: Release[], today: string) {
  const discReleases = useMemo(
    () => releases.filter((r) => r.releaseType === 'disc'),
    [releases],
  )
  const releaseJePlattform = useMemo(() => {
    const je = new Map<string, Release>()
    for (const r of releases) if (!je.has(r.platform)) je.set(r.platform, r)
    return je
  }, [releases])
  const kinoRelease = useMemo(
    () =>
      releases
        .filter((r) => r.platform === 'kino' && r.schedule?.firstEpisodeDate)
        .filter((r) =>
          r.cinemaUntil ? r.cinemaUntil >= today : r.schedule!.firstEpisodeDate! >= addDays(today, -60),
        )
        .sort((a, b) => a.schedule!.firstEpisodeDate!.localeCompare(b.schedule!.firstEpisodeDate!))[0],
    [releases, today],
  )
  return { discReleases, releaseJePlattform, kinoRelease }
}
