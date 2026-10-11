import type { StreamLink, Title } from '@shared/types.ts'
import type { Translate } from '../../lib/i18n.tsx'
import { istToggo } from './pillen.tsx'
import { legendeFuer, statusArt, type DubStatusArt } from './anbieter-zeile.tsx'
import { pillenSchluessel } from './wege-sortieren.ts'
import type { Gruppe } from './stream-pillen.ts'
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

/**
 * Die Gruppe jeder Stream-Zeile: nach Zugang (kostenlos, Abo, Kauf), außer ohne Sprachbeleg — diese Zeilen stehen
 * gesammelt unter „Weitere Anbieter“, damit die Überschrift „Auf Deutsch …“ nur über belegten Zeilen steht (Daniel, 11.10.2026).
 */
export function zeilenGruppen(sortiert: Wege, title: Title): (readonly [string, Gruppe])[] {
  return sortiert.flatMap(({ art, plattformen, streamWege }) => {
    const gruppe: Gruppe = art === 'kostenlos' ? 'frei' : art
    return [
      ...plattformen.map((s) => [pillenSchluessel(s), streamStatus(s) === 'offen' ? 'offen' : gruppe] as const),
      ...streamWege.map((g) => [`sw-${g.shop}-${g.eintraege[0].url}`, streamWegStatus(g, title) === 'offen' ? 'offen' : gruppe] as const),
    ]
  })
}

/** Gibt es Stream-Zeilen, und trägt keine einen Sprachbeleg? Dann steht kein „Auf Deutsch …“ über ihnen. */
export function alleOhneSprachbeleg(sortiert: Wege, title: Title): boolean {
  const arten = [...sortiert.flatMap((x) => x.plattformen.map(streamStatus)), ...sortiert.flatMap((x) => x.streamWege.map((g) => streamWegStatus(g, title)))]
  return arten.length > 0 && arten.every((a) => a === 'offen')
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
