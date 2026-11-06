import type { TmdbTitle } from '../fetch-tmdb-titles.ts'

export interface VonHandEintrag {
  anilistId: number
  tmdbId?: number
  kind?: 'tv' | 'movie'
  /** Der Titel hat bei TMDB keinen eigenen Eintrag: gespeicherte Kennung entfällt, der Namensabgleich sucht ihn nicht mehr. */
  ohne?: true
}

/**
 * Setzt die von Hand nachgesehenen Kennungen (`data/tmdb-von-hand.yaml`) in den Bestand; gibt die Zahl der geänderten Einträge zurück.
 * Wechselt die Kennung, entfallen die Genres der alten (der Genre-Nachtrag holt die der neuen).
 */
export function uebernimmVonHand(cache: Record<string, TmdbTitle>, eintraege: VonHandEintrag[], jetzt: string): number {
  let gesetzt = 0
  for (const e of eintraege) {
    if (!e?.anilistId) continue
    if (e.ohne) {
      if (cache[e.anilistId]) {
        delete cache[e.anilistId]
        gesetzt++
      }
      continue
    }
    if (!e.tmdbId) continue
    const alt = cache[e.anilistId]
    if (alt?.tmdbId === e.tmdbId) continue
    cache[e.anilistId] = { ...alt, genreIds: undefined, tmdbId: e.tmdbId, kind: e.kind ?? alt?.kind ?? 'tv', fetchedAt: jetzt }
    gesetzt++
  }
  return gesetzt
}
