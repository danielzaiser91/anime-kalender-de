import type { Release, Title } from '../../shared/types.ts'

/** Crunchyroll-Serienkennung → alle Titel, deren Verweis sie trägt (Staffeln teilen sich eine Kennung). */
export function titelNachSerienId(titles: Title[]): Map<string, Title[]> {
  const karte = new Map<string, Title[]>()
  for (const t of titles) {
    for (const s of t.streams) {
      const id = /crunchyroll\.com\/(?:[a-z-]+\/)?series\/([A-Z0-9]+)/i.exec(s.url)?.[1]
      if (!id) continue
      const liste = karte.get(id) ?? []
      if (!liste.includes(t)) karte.set(id, [...liste, t])
    }
  }
  return karte
}

/** Liegen alle Folgennummern im Bereich, den das Release abdeckt? Ohne Folgenzahl gilt nach oben offen. */
function passtInBereich(r: Release, nummern: number[]): boolean {
  const von = r.schedule?.firstEpisodeNumber ?? 1
  const bis = r.schedule?.episodeCount ? von + r.schedule.episodeCount - 1 : Infinity
  return nummern.every((n) => n >= von && n <= bis)
}

/**
 * **Welche Staffel hat die Folgen?** Teilen sich Staffeln eine Crunchyroll-Kennung, gehört der Fund
 * zu der, die dort ein Release hat, am Tag gestartet war und die Folgennummern abdeckt — die jüngste
 * davon. Sonst bleibt es beim ersten Titel (Re:ZERO Staffel 4, 14./15.10.2026: Meldungen hingen an Staffel 3).
 */
export function waehleStaffel(kandidaten: Title[] | undefined, releases: Release[], serienId: string, tag: string, nummern: number[]): Title | undefined {
  if (!kandidaten || kandidaten.length < 2) return kandidaten?.[0]
  const startVon = (t: Title): string | undefined =>
    releases
      .filter((r) => r.titleId === t.id && r.platform === 'crunchyroll' && r.platformUrl?.includes(serienId) && r.schedule?.firstEpisodeDate && r.schedule.firstEpisodeDate <= tag && passtInBereich(r, nummern))
      .map((r) => r.schedule!.firstEpisodeDate!)
      .sort()
      .at(-1)
  const passend = kandidaten.map((t) => ({ t, start: startVon(t) })).filter((k) => k.start)
  passend.sort((a, b) => b.start!.localeCompare(a.start!))
  return passend[0]?.t ?? kandidaten[0]
}
