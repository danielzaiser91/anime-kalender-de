import { readJson } from './util.ts'
import { anilistMasse, type CoverMasse } from './anilist-cover-masse.ts'
import { plakatMasse, type PlakatMasse } from './titel-vorschau.ts'

/** Maße aller Bilder, die eine Titelseite als Vorschau führen darf: TMDB-Plakate (`data/tmdb-poster.json`) und gemessene AniList-Cover. */
export function ladeVorschauMasse(): PlakatMasse {
  const tmdb = plakatMasse(readJson('data/tmdb-poster.json', {}))
  const anilist = anilistMasse(readJson<CoverMasse>('data/anilist-cover-masse.json', {}))
  return new Map([...tmdb, ...anilist])
}
