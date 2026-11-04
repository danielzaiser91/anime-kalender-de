import { log } from './util.ts'

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

/** Die Titel mit geteiltem Film, einmal je Bau in `ladeQuellen()` gesetzt; Plakat- und Banner-Leser filtern damit. */
let geteilteFilme = new Set<string>()
export const merkeGeteilteFilme = (ids: Set<string>): void => void (geteilteFilme = ids)

/**
 * **Plakat und Banner eines geteilten Films gehören keinem der Titel.** Gibt `daten` ohne deren Einträge zurück und meldet
 * Zahl und Kennungen im Bau-Log (`was` = Name der Quelle); wer ein anderes Cover hat, behält es über den normalen Rückfall.
 */
export function ohneGeteilteFilme<T>(daten: Record<string, T>, was: string): Record<string, T> {
  const weg = Object.keys(daten).filter((id) => geteilteFilme.has(id) && daten[id])
  if (!weg.length) return daten
  const rest = { ...daten }
  for (const id of weg) delete rest[id]
  log(`${weg.length} TMDB-${was} verworfen: derselbe Film steht bei mehreren Titeln (${weg.join(', ')})`)
  return rest
}
