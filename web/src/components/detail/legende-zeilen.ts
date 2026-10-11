import type { StreamLink, Title } from '@shared/types.ts'
import type { Translate } from '../../lib/i18n.tsx'
import { istToggo } from './pillen.tsx'
import { legendeFuer, statusArt, type DubStatusArt } from './anbieter-zeile.tsx'
import type { sortiereNachZugang } from './wege-sortieren.ts'

type Wege = ReturnType<typeof sortiereNachZugang>
type Kaufweg = Wege[number]['streamWege'][number]

/** Der Sprachzustand eines Stream-Links: Beleg am Weg, JustWatch (mit Datum) oder offen. */
export const streamStatus = (s: StreamLink): DubStatusArt => statusArt(s.dub, s.dubQuelle === 'justwatch' ? s.dubStand : undefined)

/** Der Sprachzustand eines Wegs über einen Dritten („Crunchyroll über Prime Video“): TOGGO ist rein deutsch, sonst zählen Bereiche und der Verweis mit derselben Adresse. */
export function streamWegStatus(g: Kaufweg, title: Title): DubStatusArt {
  const e = g.eintraege[0]
  return statusArt(istToggo(e.url) || e.dubRanges?.some((r) => r.dub) || (title.streams ?? []).find((x) => x.url === e.url)?.dub)
}

/** Die Legende unter den Stream-Zeilen: erklärt „laut JustWatch“, „Sprache offen“ und „≈“, wo sie vorkommen. */
export function legendeDerZeilen({ sortiert, title, folgenAngabeFuer, t }: {
  sortiert: Wege
  title: Title
  folgenAngabeFuer: (s: StreamLink) => string
  t: Translate
}): string | undefined {
  const links = sortiert.flatMap((x) => x.plattformen)
  const arten = [...links.map(streamStatus), ...sortiert.flatMap((x) => x.streamWege.map((g) => streamWegStatus(g, title)))]
  return legendeFuer(arten, links.some((s) => folgenAngabeFuer(s).startsWith('≈')), t)
}
