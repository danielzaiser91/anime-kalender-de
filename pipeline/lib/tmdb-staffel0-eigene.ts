import { readJson, writeJson } from './util.ts'
import { ladeEigeneCover } from './cover-quelle.ts'
import { BANNER_DATEI, type TmdbBanner } from './tmdb-banner.ts'
import type { PlakatBestand } from './tmdb-plakat-suche.ts'
import { STAFFEL0_DATEI, streiche, type Bestaende, type Staffel0Bestand } from './tmdb-staffel0-abruf.ts'

/**
 * Ein Titel hat genau eine TMDB-Zuordnung: Trägt er eine eigene Kennung (Serie oder Film in `data/tmdb-titles.json`), fällt sein Eintrag in der
 * Staffel 0 samt den Bildern weg, die dieser gesetzt hat (`streiche`). Gibt die gestrichenen Kennungen zurück.
 */
export function streicheStaffel0MitKennung(zuordnung: Record<string, { tmdbId?: number } | null | undefined>, bestaende: Bestaende): string[] {
  const gestrichen = Object.keys(bestaende.eintraege).filter((id) => zuordnung[id]?.tmdbId)
  for (const id of gestrichen) streiche(id, bestaende)
  return gestrichen
}

/** Wie `streicheStaffel0MitKennung`, aber über die Dateien; schreibt nur, wenn etwas wegfällt. */
export function raeumeStaffel0Auf(zuordnung: Record<string, { tmdbId?: number } | null | undefined>): string[] {
  const bestaende: Bestaende = {
    eintraege: readJson<Staffel0Bestand>(STAFFEL0_DATEI, {}),
    poster: readJson<PlakatBestand>('data/tmdb-poster.json', {}),
    banner: readJson<TmdbBanner>(BANNER_DATEI, {}),
    eigeneCover: ladeEigeneCover(),
  }
  const gestrichen = streicheStaffel0MitKennung(zuordnung, bestaende)
  if (!gestrichen.length) return gestrichen
  writeJson(STAFFEL0_DATEI, bestaende.eintraege)
  writeJson('data/tmdb-poster.json', bestaende.poster)
  writeJson(BANNER_DATEI, bestaende.banner)
  return gestrichen
}
