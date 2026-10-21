import type { Release, StreamLink, Title } from '@shared/types.ts'
import { streamNurOmu } from '@shared/ankuendigung.ts'
import { adresseIstOmu } from '@shared/omu-adresse.ts'
import type { Translate } from '../../lib/i18n.tsx'
import { istToggo } from './pillen.tsx'
import { legendeFuer, statusArt, type DubStatusArt } from './pille.tsx'
import { pillenSchluessel } from './wege-sortieren.ts'
import type { Gruppe } from './stream-pillen.ts'
import type { sortiereNachZugang } from './wege-sortieren.ts'

type Wege = ReturnType<typeof sortiereNachZugang>
type Kaufweg = Wege[number]['streamWege'][number]

/** Der Sprachzustand eines Stream-Links: Beleg am Weg, JustWatch (mit Datum), nur Untertitel (Ankündigung oder Termin mit Quelle „nur Originalton“) oder offen. */
export function streamStatus(title: Title, s: StreamLink, releases: Release[]): DubStatusArt {
  const art = statusArt(s.dub, s.dubQuelle === 'justwatch' ? s.dubStand : undefined)
  if (art === 'justwatch' && !s.dubHintOnly) return 'jwDeutsch'
  return art === 'offen' && (streamNurOmu(title, s, releases) || adresseIstOmu(s.url)) ? 'omu' : art
}

/** Weder belegt noch von JustWatch gemeldet: die Zeile steht unter „Weitere Anbieter“ und trägt keinen Sprachbeleg. */
const ohneBeleg = (art: DubStatusArt): boolean => art === 'offen' || art === 'omu'

/** Deutsch nur aus der Annahme über den Telekom-Katalog (`pipeline/lib/telekom-annahme.ts`), ohne Angabe des Wegs selbst. */
export const istAnnahme = (e: { dubAbgeleitet?: string }): boolean => e.dubAbgeleitet === 'telekom-annahme'

/** Der Sprachzustand eines Wegs über einen Dritten („Crunchyroll über Prime Video“): TOGGO ist rein deutsch, sonst zählen Bereiche und der Verweis mit derselben Adresse. */
export function streamWegStatus(g: Kaufweg, title: Title): DubStatusArt {
  const e = g.eintraege[0]
  /* Die Annahme trägt `dubRanges`, ist aber kein Beleg: Sie geht jedem Haken voran. */
  if (istAnnahme(e)) return 'annahme'
  const art = statusArt(istToggo(e.url) || e.dubRanges?.some((r) => r.dub) || (title.streams ?? []).find((x) => x.url === e.url)?.dub)
  /* Abgeleitet, nie belegt: Ein Beleg am Weg geht vor, und „schwester“ zählt nirgends als Haken. */
  if (art === 'offen' && e.dubAbgeleitet) return 'schwester'
  return art === 'offen' && adresseIstOmu(e.url) ? 'omu' : art
}

/**
 * Die Gruppe jeder Stream-Zeile: nach Zugang (kostenlos, Abo, Kauf), außer ohne Sprachbeleg — diese Zeilen stehen
 * gesammelt unter „Weitere Anbieter“, damit die Überschrift „Auf Deutsch …“ nur über belegten Zeilen steht (Daniel, 11.10.2026).
 */
export function zeilenGruppen(sortiert: Wege, title: Title, releases: Release[]): (readonly [string, Gruppe])[] {
  return sortiert.flatMap(({ art, plattformen, streamWege }) => {
    const gruppe: Gruppe = art === 'kostenlos' ? 'frei' : art
    return [
      ...plattformen.map((s) => [pillenSchluessel(s), ohneBeleg(streamStatus(title, s, releases)) ? 'offen' : gruppe] as const),
      ...streamWege.map((g) => [`sw-${g.shop}-${g.eintraege[0].url}`, streamWegStatus(g, title) === 'offen' ? 'offen' : gruppe] as const),
    ]
  })
}

/** Gibt es Stream-Zeilen, und trägt keine einen Sprachbeleg? Dann steht kein „Auf Deutsch …“ über ihnen. */
export function alleOhneSprachbeleg(sortiert: Wege, title: Title, releases: Release[]): boolean {
  const arten = [...sortiert.flatMap((x) => x.plattformen.map((s) => streamStatus(title, s, releases))), ...sortiert.flatMap((x) => x.streamWege.map((g) => streamWegStatus(g, title)))]
  return arten.length > 0 && arten.every(ohneBeleg)
}

/** Alle Stream-Zeilen tragen nur Untertitel (OmU): Der Kopf sagt „nur Untertitel“ statt „Sprache offen“. */
export function alleNurUntertitel(sortiert: Wege, title: Title, releases: Release[]): boolean {
  const arten = [...sortiert.flatMap((x) => x.plattformen.map((s) => streamStatus(title, s, releases))), ...sortiert.flatMap((x) => x.streamWege.map((g) => streamWegStatus(g, title)))]
  return arten.length > 0 && arten.every((a) => a === 'omu')
}

/** Die Legende unter den Stream-Zeilen: erklärt „laut JustWatch“ und „≈“, wo sie vorkommen. */
export function legendeDerZeilen({ sortiert, title, releases, folgenAngabeFuer, t }: {
  sortiert: Wege
  title: Title
  releases: Release[]
  folgenAngabeFuer: (s: StreamLink) => string
  t: Translate
}): string | undefined {
  const links = sortiert.flatMap((x) => x.plattformen)
  const arten = [...links.map((s) => streamStatus(title, s, releases)),...sortiert.flatMap((x) => x.streamWege.map((g) => streamWegStatus(g, title)))]
  return legendeFuer(arten, links.some((s) => folgenAngabeFuer(s).startsWith('≈')), t)
}
