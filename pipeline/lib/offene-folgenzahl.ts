import type { CrTermin } from './crunchyroll-termine.ts'

type AnisearchInfo = { episodes?: number; episodesEstimated?: boolean } | undefined

/**
 * Die Länge einer laufenden Crunchyroll-Staffel, deren Titel keine Folgenzahl trägt (`CrTermin.zahlOffen`; Psyren 26.10.2026: AniList kennt
 * sie nicht, aniSearch führt 12). Dieselbe Regel wie `06-cr-simuldubs.ts`: aniSearchs Zahl, sonst zwölf als übliche Cour-Länge, nie unter
 * den bisher deutschen Folgen; geraten bleibt sie, solange aniSearch sie nicht fest nennt.
 */
export function offeneFolgenzahl(bisher: number, anisearch: AnisearchInfo): { episodeCount: number; episodeCountAssumed: boolean } {
  const bekannt = anisearch?.episodes || undefined
  const episodeCount = Math.max(bekannt ?? 12, bisher)
  return { episodeCount, episodeCountAssumed: anisearch?.episodesEstimated === true || episodeCount !== bekannt }
}

/** Die Zahl-Felder des Termins für `schedule`: unverändert, außer die Staffel läuft ohne bekannte Länge. */
export function zahlFelder(t: CrTermin, info: AnisearchInfo): { episodeCount: number; episodeCountAssumed?: true } {
  if (!t.zahlOffen) return { episodeCount: t.episodeCount }
  const { episodeCount, episodeCountAssumed } = offeneFolgenzahl(t.episodeCount, info)
  return { episodeCount, ...(episodeCountAssumed ? { episodeCountAssumed: true as const } : {}) }
}
