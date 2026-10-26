import { slugify } from '../lib/util.ts'
import type { Title } from '../../shared/types.ts'
import type { KatalogEintrag } from '../lib/anilist.ts'

/**
 * Ein Titel aus dem AniList-Katalog ist ein vollwertiger Titel — er trägt dieselben Felder, nur aus einer anderen Quelle.
 * `low` ist richtig: Der Katalog belegt nur, dass es den Anime gibt, nicht seine Synchro.
 */
export function titelAusKatalogEintrag(e: KatalogEintrag): Title {
  const anzeige = e.t[1] ?? e.latein ?? e.t[0] ?? String(e.id)
  return {
    id: e.id,
    slug: `${slugify(anzeige)}-${e.id}`,
    keywords: [],
    dubConfidence: 'low' as const,
    titleRomaji: e.t[0] ?? undefined,
    titleEn: e.t[1] ?? e.latein ?? undefined,
    titleNative: e.t[2] ?? undefined,
    format: e.format ?? undefined,
    jpYear: e.jahr ?? undefined,
    episodes: e.folgen ?? undefined,
    genres: e.genres?.length ? [...e.genres] : [],
    coverImage: e.cover ? `https://s4.anilist.co/file/anilistcdn/media/anime/cover/${e.cover}` : undefined,
    streams: [],
  }
}
