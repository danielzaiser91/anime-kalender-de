/**
 * **Aus gesichteten TV-Sendungen werden Termine** (16.09.2026).
 *
 * `fetch-tv-programm.ts` sammelt täglich, was bei den Sendern der RTL-Gruppe
 * läuft. Die Quelle nennt je Sendung Tag, Uhrzeit und Folgentitel — **keine
 * Folgennummer und kein Ende**. Deshalb:
 *
 * - Jeder **neue Folgentitel** zählt als nächste Folge; eine Wiederholung
 *   desselben Titels zählt nicht noch einmal.
 * - Kein Termin wird fortgeschrieben. Die Reihe gilt als laufend, solange die
 *   letzte Sichtung höchstens sieben Tage zurückliegt (`tvLetzteSichtung`,
 *   ausgewertet in `releaseStatus()`).
 * - Ein von Hand gepflegter TV-Termin desselben Titels beim selben Sender
 *   gewinnt; er kennt die Folgennummern.
 */
import type { Release, Title } from '../../shared/types.ts'
import type { TvSendung } from '../fetch-tv-programm.ts'

const berlinTag = (iso: string) => iso.slice(0, 10)
const berlinZeit = (iso: string) => iso.slice(11, 16)
const slugTeil = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export function releasesAusTvProgramm(
  sendungen: TvSendung[],
  titles: Map<number, Title>,
  vorhanden: Release[],
): Release[] {
  const belegt = new Set(
    vorhanden.filter((r) => r.platform === 'tv').map((r) => `${r.titleId}|${(r.sender ?? '').toLowerCase()}`),
  )
  const gruppen = new Map<string, TvSendung[]>()
  for (const s of sendungen) {
    const k = `${s.titleId}|${s.sender.toLowerCase()}`
    if (belegt.has(k) || !titles.has(s.titleId)) continue
    gruppen.set(k, [...(gruppen.get(k) ?? []), s])
  }
  const aus: Release[] = []
  for (const liste of gruppen.values()) {
    liste.sort((a, b) => a.start.localeCompare(b.start))
    const erste = liste[0]!
    const title = titles.get(erste.titleId)!
    /* Neue Folgentitel in Sendereihenfolge; ohne Folgentitel zählt jeder Sendetag. */
    const observed: Record<number, string> = {}
    const gesehen = new Set<string>()
    let n = 0
    for (const s of liste) {
      const schluessel = s.folge ?? `tag:${berlinTag(s.start)}`
      if (gesehen.has(schluessel)) continue
      gesehen.add(schluessel)
      observed[++n] = berlinTag(s.start)
    }
    /* Die Uhrzeit nur, wenn alle Sendungen um dieselbe liefen. */
    const zeiten = new Set(liste.map((s) => berlinZeit(s.start)))
    const name = title.titleDe ?? title.titleEn ?? title.titleRomaji ?? erste.titel
    aus.push({
      slug: `auto-${erste.titleId}-tv-${slugTeil(erste.sender)}`,
      titleId: erste.titleId,
      name,
      platform: 'tv',
      sender: erste.sender,
      releaseType: 'weekly',
      schedule: {
        firstEpisodeDate: berlinTag(erste.start),
        ...(zeiten.size === 1 ? { time: [...zeiten][0] } : {}),
        episodeCount: n,
        observed,
      },
      tvLetzteSichtung: berlinTag(liste[liste.length - 1]!.start),
      year: Number(erste.start.slice(0, 4)),
      herkunft: `Automatisch aus dem TV-Programm von RTL+ (${liste.length} Sendungen gesichtet).`,
      automatisch: true,
      sources: ['https://plus.rtl.de/tv-programm'],
    })
  }
  return aus
}
