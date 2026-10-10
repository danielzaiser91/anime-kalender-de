import { useMemo } from 'react'
import type { Release, Title } from '@shared/types.ts'
import { jetztBerlin } from '../../lib/toggo.ts'
import { tvAngabe } from '../../lib/tv-angabe.ts'

/**
 * Die Termine, die als Pille mit Sender oder Anbieter stehen können — ohne Kino (hat seinen
 * Banner) und ohne Discs.
 *
 * Ein Fernsehtermin, der vorbei ist, ist kein Weg zur Folge: „niemand kann in die vergangenheit
 * reisen und dort die folge gucken". Eine TV-Pille steht deshalb nur, solange eine Sendung läuft
 * oder eine kommt.
 */
export function useTerminReleases(releases: Release[], title: Title | undefined, kinoSlug: string | undefined, today: string): Release[] {
  return useMemo(
    () =>
      releases.filter(
        (r) =>
          r.releaseType !== 'disc' &&
          r.slug !== kinoSlug &&
          (r.platform !== 'tv' || !title || Boolean(tvAngabe(r, title, releases, today, jetztBerlin().slice(11, 16)))),
      ),
    [releases, title, kinoSlug, today],
  )
}
