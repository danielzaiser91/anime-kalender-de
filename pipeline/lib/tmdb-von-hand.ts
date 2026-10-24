import type { TmdbTitle } from '../fetch-tmdb-titles.ts'

export interface VonHandEintrag {
  anilistId: number
  tmdbId: number
  kind?: 'tv' | 'movie'
}

/**
 * Setzt die von Hand nachgesehenen Kennungen (`data/tmdb-von-hand.yaml`) in den Bestand; gibt die Zahl der geänderten Einträge zurück.
 * Wechselt die Kennung, entfallen die Genres der alten (der Genre-Nachtrag holt die der neuen).
 */
export function uebernimmVonHand(cache: Record<string, TmdbTitle>, eintraege: VonHandEintrag[], jetzt: string): number {
  let gesetzt = 0
  for (const e of eintraege) {
    if (!e?.anilistId || !e.tmdbId) continue
    const alt = cache[e.anilistId]
    if (alt?.tmdbId === e.tmdbId) continue
    cache[e.anilistId] = { ...alt, genreIds: undefined, tmdbId: e.tmdbId, kind: e.kind ?? alt?.kind ?? 'tv', fetchedAt: jetzt }
    gesetzt++
  }
  return gesetzt
}
