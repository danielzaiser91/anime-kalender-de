/** Welche Titel der Trailerlauf abfragt und wie er TMDBs Videoliste anspricht. */

/** Filme (Kinokanäle) und die Einstiege des Entdecken-Pools (`empfehlung.json`, Reihe → erster Teil). */
export function trailerKandidaten<T extends { id: number; format?: string }>(titel: T[], einstiege: ReadonlySet<number>): T[] {
  return titel.filter((t) => t.format === 'MOVIE' || einstiege.has(t.id))
}

/** `/videos` liefert ohne `include_video_language` nur die Sprache des Abrufs (englisch); de, en und ja müssen ausdrücklich verlangt werden. */
export function tmdbVideosUrl(basis: string, art: string, tmdbId: number, schluessel: string): string {
  const pfad = art === 'movie' ? 'movie' : 'tv'
  return `${basis}/${pfad}/${tmdbId}/videos?include_video_language=de,en,ja&api_key=${schluessel}`
}
