/** TMDB-Genre „Animation": Wir sind eine Anime-Seite, ein Treffer ohne dieses Genre ist ein Realfilm oder eine Realserie gleichen Namens. */
export const ANIMATION = 16

/** Unwiderlegt, solange TMDB gar kein Genre nennt; widerlegt, sobald es welche nennt und Animation fehlt. */
export const keineAnimation = (genreIds?: number[]): boolean => !!genreIds?.length && !genreIds.includes(ANIMATION)

type Eintrag = { tmdbId?: number; kind?: string; genreIds?: number[] }

/** Die Titel, deren gespeicherte Zuordnung widerlegt ist (Genre bekannt, ohne Animation); von Hand gesetzte (`data/tmdb-von-hand.yaml`) bleiben außen vor. */
export function ohneAnimation(cache: Record<string, Eintrag>, vonHand: Set<number>): number[] {
  return Object.entries(cache)
    .filter(([id, e]) => e.tmdbId && keineAnimation(e.genreIds) && !vonHand.has(Number(id)))
    .map(([id]) => Number(id))
}

/** Titel mit Zuordnung, deren Genre noch nie gelesen wurde (Bestand aus der Zeit vor `genreIds`). */
export const genreUngemessen = (cache: Record<string, Eintrag>): number[] =>
  Object.entries(cache).filter(([, e]) => e.tmdbId && !e.genreIds).map(([id]) => Number(id))
