import { readJson } from './util.ts'

/**
 * **Woher ein Cover kommt** (Daniel, 11.10.2026): zuerst das TMDB-Plakat des Titels (`data/tmdb-poster.json`, als `w500`), sonst das bisherige
 * AniList-Cover, sonst die eigene Kopie des aniSearch-Covers (Cloudflare R2, `data/cover-eigen.json`), sonst keines (die Oberfläche zeigt dann den
 * Platzhalter). aniSearch-Cover werden nie von aniSearch aus eingebunden, nur von der eigenen Bild-Domain.
 */
const TMDB_BILD = 'https://image.tmdb.org/t/p/w500'
const ANISEARCH_AB = 10_000_000

/** Öffentliche Adresse des Buckets `anime-kalender-cover` (eigene Domain, Zweck und Anlegen: `docs/wissen/quellen.md`, Abschnitt „Eigene Cover“). */
export const COVER_EIGEN_BASIS = 'https://cover.anime-kalender.de/'

export type TmdbPlakate = Record<string, { p: string } | null>
/** aniSearch-Kennung → Eintrag des Manifests; `datei` fehlt bei Einträgen ohne Bild. */
export type EigeneCover = Record<string, { datei?: string }>

export const ladeTmdbPlakate = (): TmdbPlakate => readJson<TmdbPlakate>('data/tmdb-poster.json', {})
export const ladeEigeneCover = (): EigeneCover => readJson<EigeneCover>('data/cover-eigen.json', {})

/** Die Adresse für einen Titel nach der Regel; `bisher` ist sein AniList-Cover (gekürzt oder voll). */
export function coverNachRegel(titelId: number, bisher: string | undefined, plakate: TmdbPlakate, eigene: EigeneCover): string | undefined {
  const plakat = plakate[String(titelId)]
  if (plakat?.p) return `${TMDB_BILD}${plakat.p}`
  if (bisher) return bisher
  const datei = titelId >= ANISEARCH_AB ? eigene[String(titelId - ANISEARCH_AB)]?.datei : undefined
  return datei ? `${COVER_EIGEN_BASIS}${datei}` : undefined
}
