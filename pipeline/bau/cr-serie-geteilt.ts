import type { Title } from '../../shared/types.ts'

/**
 * **Eine Crunchyroll-Serie mit einer Staffel gehört nicht automatisch jedem Titel, der auf sie zeigt.**
 *
 * „Tokyo Revengers" führt bei Crunchyroll genau eine Staffel mit 24 Folgen, alle deutsch. Auf dieselbe Adresse zeigen aber
 * auch Staffel 2 (13 Folgen), Tenjiku (13) und „War of the Three Titans" (13) — zusammen 39 Folgen für eine Serie mit 24.
 * Die Staffeln 2 und 3 liefen auf Deutsch nur bei Disney+; unser Kalender behauptete am 04.10.2026 trotzdem „Neu auf
 * Deutsch bei Crunchyroll" (Daniel). Zugeordnet wird über die Folgenzahl: Beanspruchen die Titel zusammen mehr Folgen, als
 * die Serie hat, trägt die Serienebene für keinen von ihnen. Gemessen am 04.10.2026: 2 Serien betroffen, eine davon richtig
 * (86 EIGHTY-SIX, 23 gegen 26 Folgen, bleibt unberührt).
 */
export function folgenSummeJeKennung(titles: Map<number, Title>): Map<string, number> {
  const summe = new Map<string, number>()
  for (const t of titles.values()) {
    const s = t.streams.find((x) => x.platform === 'crunchyroll')
    const kennung = s && /\/series\/([A-Z0-9]+)/.exec(s.url)?.[1]
    if (kennung) summe.set(kennung, (summe.get(kennung) ?? 0) + (t.episodes ?? 0))
  }
  return summe
}

export function ueberbelegt(summen: Map<string, number>, kennung: string, katalogFolgen: number | undefined): boolean {
  return katalogFolgen !== undefined && (summen.get(kennung) ?? 0) > katalogFolgen
}

/**
 * Wo die Titel zusammen mehr Folgen beanspruchen, als die einzige Staffel der Serie hat, behält die Adresse nur der
 * Titel mit genau deren Folgenzahl; bei den übrigen fällt der Crunchyroll-Weg weg (Daniel, 04.10.2026: Christmas
 * Showdown, Tenjiku Arc und War of the Three Titans liefen nie bei Crunchyroll, dort gibt es nur Staffel 1).
 */
export function entferneFremdeCrWege(titles: Map<number, Title>, nachKennung: Map<string, { folgen?: number; staffeln?: number }>, summen: Map<string, number>): number {
  let weg = 0
  for (const t of titles.values()) {
    const s = t.streams.find((x) => x.platform === 'crunchyroll')
    const kennung = s && /\/series\/([A-Z0-9]+)/.exec(s.url)?.[1]
    const eintrag = kennung ? nachKennung.get(kennung) : undefined
    if (!kennung || !eintrag || (eintrag.staffeln ?? 0) !== 1 || !ueberbelegt(summen, kennung, eintrag.folgen) || t.episodes === eintrag.folgen) continue
    t.streams = t.streams.filter((x) => x !== s)
    weg++
  }
  return weg
}
