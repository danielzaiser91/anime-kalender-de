import { readJson } from './util.ts'
import { anilistMasse, type CoverMasse } from './anilist-cover-masse.ts'
import { eigeneMasse, type EigeneMasse } from './eigene-cover-masse.ts'
import { cartoonMasse, type CartoonMasse } from './cartoon-cover-masse.ts'
import { plakatMasse, type PlakatMasse } from './titel-vorschau.ts'

/** Maße aller Bilder, die eine Titelseite als Vorschau führen darf: TMDB-Plakate (`data/tmdb-poster.json`) und gemessene AniList-, aniSearch- und Cartoon-Cover. */
export function ladeVorschauMasse(): PlakatMasse {
  const tmdb = plakatMasse(readJson('data/tmdb-poster.json', {}))
  const anilist = anilistMasse(readJson<CoverMasse>('data/anilist-cover-masse.json', {}))
  const eigen = eigeneMasse(readJson<EigeneMasse>('data/cover-eigen-masse.json', {}))
  const cartoon = cartoonMasse(readJson<CartoonMasse>('data/cartoon-cover-masse.json', {}))
  return new Map([...tmdb, ...anilist, ...eigen, ...cartoon])
}
