import { ohneAnimation, genreUngemessen } from './tmdb-genre.ts'

type Eintrag = { tmdbId?: number; kind?: string; genreIds?: number[] }

/** Holt zu jeder Zuordnung ohne `genreIds` das Genre (`hole`); gibt `undefined` zurück, wenn TMDB nicht antwortet. */
export type GenreHolen = (kind: string, tmdbId: number) => Promise<{ genreIds: number[]; info?: string } | undefined>

/**
 * Trägt die Genres nach und entfernt Zuordnungen ohne Animation samt dem, was an ihnen hängt (die Tabellen in `abgeleitet`, je AniList-ID).
 * Der entfernte Titel gilt als „nie geholt": der nächste `data:tmdb`-Lauf sucht ihn mit der Genre-Prüfung neu, vor allen anderen.
 */
export async function genreNachtragen(
  cache: Record<string, Eintrag>,
  vonHand: Set<number>,
  abgeleitet: Record<string, object>[],
  hole: GenreHolen,
): Promise<{ gemessen: number; unbeantwortet: number; entfernt: number[]; infos: string[] }> {
  let gemessen = 0
  let unbeantwortet = 0
  const infos = new Map<number, string>()
  for (const id of genreUngemessen(cache)) {
    const e = cache[id]!
    const genres = await hole(e.kind ?? 'tv', e.tmdbId!)
    if (genres) {
      e.genreIds = genres.genreIds
      if (genres.info) infos.set(id, genres.info)
      gemessen++
    } else unbeantwortet++
  }
  const entfernt = ohneAnimation(cache, vonHand)
  for (const id of entfernt) {
    delete cache[id]
    for (const tabelle of abgeleitet) delete tabelle[id]
  }
  return { gemessen, unbeantwortet, entfernt, infos: entfernt.map((id) => `${id}: ${infos.get(id) ?? '?'}`) }
}
