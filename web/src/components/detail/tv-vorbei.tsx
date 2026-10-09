import { useMemo, type ReactElement } from 'react'
import type { Release } from '@shared/types.ts'
import { ReleasePille } from './pillen.tsx'
import { jetztBerlin } from '../../lib/toggo.ts'
import { tvZuletzt, type TvZuletzt } from '../../lib/tv-zuletzt.ts'

/**
 * Lief ein Titel nur noch früher im Fernsehen, steht der letzte Termin je Sender dort, wo sonst
 * „Kein Anbieter bekannt" stünde — nur wenn es keine andere Pille gibt (Daniel, 09.10.2026).
 */
export function useTvVorbei(wegeHinweis: string | undefined, streamReleases: Release[], releases: Release[], today: string): TvZuletzt[] {
  return useMemo(
    () => (wegeHinweis && streamReleases.length === 0 ? tvZuletzt(releases, today, jetztBerlin().slice(11, 16)) : []),
    [wegeHinweis, streamReleases, releases, today],
  )
}

/** Schlüssel → Bereich „TV" für `AntwortKasten`. */
export const tvVorbeiGruppen = (liste: TvZuletzt[]): Array<readonly [string, 'tv']> =>
  [...liste.map(({ release }) => `${release.slug}|vorbei`), ...(liste.length ? ['tv-vorbei-satz'] : [])].map((k) => [k, 'tv'] as const)

/** Die Pillen mit dem letzten Termin, dahinter in voller Breite der Satz, dass keiner mehr aussteht. */
export function tvVorbeiPillen(liste: TvZuletzt[], titel: string, today: string, satz: string): ReactElement[] {
  if (!liste.length) return []
  return [
    ...liste.map(({ release, text }) => (
      <ReleasePille key={`${release.slug}|vorbei`} release={release} titel={titel} today={today} tvText={{ text, premiere: false }} />
    )),
    <p key="tv-vorbei-satz" className="basis-full text-xs text-slate-500 dark:text-slate-400">{satz}</p>,
  ]
}
