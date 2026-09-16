/**
 * **Ein TMDB-Film gehört genau einem Titel.**
 *
 * Gemessen am 16.09.2026: Fünf Film-Kennungen waren mehreren AniList-Titeln
 * zugeordnet, alle in Filmreihen — „Code Geass: Akito the Exiled" Teil 1 und 2
 * teilten sich `movie/212161` und damit den deutschen Titel „Der zerrissene
 * Wyvern", die drei Kapitel von „Princess Principal: Crown Handler" hießen alle
 * „Crown Handler 4". Die Zuordnung sucht nach Namensähnlichkeit, und die Teile
 * einer Reihe sind einander ähnlicher als jedem anderen Werk.
 *
 * Welcher der Beteiligten richtig zugeordnet ist, lässt sich aus den Daten nicht
 * entscheiden. Deshalb verlieren **alle** die TMDB-Angaben — Titel, Beschreibung,
 * FSK und Anbieter. Eine falsche Zuordnung ist hier schlimmer als keine: Sie
 * bringt einem Film den Namen und die Kaufadresse eines anderen.
 *
 * **Die Art gehört zum Schlüssel.** TMDB zählt Serien und Filme in getrennten
 * Nummernräumen: `tv/34065` ist „Black Cat", `movie/34065` ein Pokémon-Film. Eine
 * Prüfung über die Zahl allein meldete 139 Doppelungen, davon 134 zu Unrecht.
 *
 * Serien dürfen sich eine Kennung teilen — die Staffeln eines Werks stehen bei
 * TMDB unter einer Serie.
 */
export function mehrdeutigeFilmzuordnungen(
  zuordnung: Record<string, { tmdbId?: number; kind?: 'tv' | 'movie' }>,
): Set<string> {
  const jeFilm = new Map<number, string[]>()
  for (const [titelId, eintrag] of Object.entries(zuordnung)) {
    if (!eintrag?.tmdbId || eintrag.kind !== 'movie') continue
    const liste = jeFilm.get(eintrag.tmdbId) ?? []
    liste.push(titelId)
    jeFilm.set(eintrag.tmdbId, liste)
  }
  const raus = new Set<string>()
  for (const liste of jeFilm.values()) if (liste.length > 1) for (const id of liste) raus.add(id)
  return raus
}
