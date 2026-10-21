import type { TmdbTitle } from '../fetch-tmdb-titles.ts'

export interface VonHandEintrag {
  anilistId: number
  tmdbId: number
  kind?: 'tv' | 'movie'
}

/** Setzt die von Hand nachgesehenen Kennungen (`data/tmdb-von-hand.yaml`) in den Bestand; gibt die Zahl der geänderten Einträge zurück. */
export function uebernimmVonHand(cache: Record<string, TmdbTitle>, eintraege: VonHandEintrag[], jetzt: string): number {
  let gesetzt = 0
  for (const e of eintraege) {
    if (!e?.anilistId || !e.tmdbId) continue
    const alt = cache[e.anilistId]
    if (alt?.tmdbId === e.tmdbId) continue
    cache[e.anilistId] = { ...alt, tmdbId: e.tmdbId, kind: e.kind ?? alt?.kind ?? 'tv', fetchedAt: jetzt }
    gesetzt++
  }
  return gesetzt
}
