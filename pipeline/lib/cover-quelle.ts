import { readJson } from './util.ts'

/**
 * **Woher ein Cover kommt** (Daniel, 11.10.2026): zuerst das TMDB-Plakat des Titels (`data/tmdb-poster.json`, als `w500`), sonst das bisherige
 * AniList-Cover, sonst keines (die Oberfläche zeigt dann den Platzhalter). aniSearch-Cover dürfen nicht verlinkt werden.
 */
const TMDB_BILD = 'https://image.tmdb.org/t/p/w500'

export type TmdbPlakate = Record<string, { p: string } | null>

export const ladeTmdbPlakate = (): TmdbPlakate => readJson<TmdbPlakate>('data/tmdb-poster.json', {})

/** Die Adresse für einen Titel nach der Regel; `bisher` ist sein AniList-Cover (gekürzt oder voll). */
export function coverNachRegel(titelId: number, bisher: string | undefined, plakate: TmdbPlakate): string | undefined {
  const plakat = plakate[String(titelId)]
  return plakat?.p ? `${TMDB_BILD}${plakat.p}` : bisher
}
