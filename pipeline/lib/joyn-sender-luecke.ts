/**
 * Fernsehtermin bei einem Sender mit Joyn-Mediathek, aber kein Joyn-Weg am Titel (Yaiba, 05.11.2026).
 *
 * Joyn zeigt die Folgen einer ProSieben-Sendung nach der Ausstrahlung; ohne Joyn-Weg am Titel fehlen
 * Pille, Adresse und das Abruffenster aus den TV-Terminen (`13-1-anreichern.ts`). Joyn selbst lesen wir nicht
 * (TDM-Vorbehalt): der Weg kommt aus JustWatch oder als Handbeleg. Der Wächter meldet nur, er legt nichts an.
 */
import type { Release, Title } from '../../shared/types.ts'

/** Sender der ProSieben-Gruppe, deren Sendungen Joyn führt (klein geschrieben). */
export const JOYN_SENDER = ['prosieben', 'prosieben maxx', 'prosieben fun', 'sat.1', 'kabel eins', 'sixx']

export interface JoynLuecke {
  titleId: number
  name: string
  sender: string
}

/** Titel mit gestartetem TV-Termin bei einem Joyn-Sender und ohne Joyn-Weg, je Titel einmal, nach Kennung sortiert. */
export function joynLuecken(releases: Release[], titles: Pick<Title, 'id' | 'streams'>[], heute: string): JoynLuecke[] {
  const mitJoyn = new Set(titles.filter((t) => (t.streams ?? []).some((s) => s.platform === 'joyn')).map((t) => t.id))
  const gefunden = new Map<number, JoynLuecke>()
  for (const r of releases) {
    const start = r.schedule?.firstEpisodeDate
    if (r.platform !== 'tv' || !start || start > heute) continue
    if (!JOYN_SENDER.includes((r.sender ?? '').toLowerCase()) || mitJoyn.has(r.titleId)) continue
    if (!gefunden.has(r.titleId)) gefunden.set(r.titleId, { titleId: r.titleId, name: r.name, sender: r.sender ?? '' })
  }
  return [...gefunden.values()].sort((a, b) => a.titleId - b.titleId)
}

/** Die eine Warnzeile für `commit-data.sh`; leer, wenn es keine Lücke gibt. */
export function joynLueckeZeile(luecken: JoynLuecke[]): string {
  if (!luecken.length) return ''
  const liste = luecken.map((l) => `${l.name} (${l.titleId}, ${l.sender})`).join('; ')
  return `⚠ WARNUNG Joyn-Lücke: ${luecken.length} Titel mit TV-Termin bei einem Joyn-Sender, aber ohne Joyn-Weg — Handbeleg (platform joyn) in data/dub-confirmed.yaml oder JustWatch abwarten: ${liste}`
}
