import { log } from '../lib/util.ts'
import { coverNachRegel, COVER_EIGEN_BASIS, ladeEigeneCover, ladeTmdbPlakate, type EigeneCover, type TmdbPlakate } from '../lib/cover-quelle.ts'
import type { Title } from '../../shared/types.ts'

let plakate: TmdbPlakate | undefined
let eigene: EigeneCover | undefined
/** Einmal je Bau geladen; der Katalog (`nebendateien.ts`) nutzt dieselben Plakate. */
const tmdbPlakate = (): TmdbPlakate => (plakate ??= ladeTmdbPlakate())
const eigeneCover = (): EigeneCover => (eigene ??= ladeEigeneCover())

/** Das Cover eines Titels nach der Regel; für Katalogzeilen und die Kopien in `verschoben`, die vor `setzeCoverNachRegel` entstanden. */
export const coverFuer = (titelId: number, bisher: string | undefined): string | undefined => coverNachRegel(titelId, bisher, tmdbPlakate(), eigeneCover())

function herkunft(cover: string | undefined): 'TMDB' | 'aniSearch' | 'AniList' | 'keins' {
  if (!cover) return 'keins'
  if (cover.includes('tmdb.org')) return 'TMDB'
  return cover.startsWith(COVER_EIGEN_BASIS) ? 'aniSearch' : 'AniList'
}

/**
 * **Jeder Titel bekommt sein Cover nach der Regel** TMDB → AniList → eigene aniSearch-Kopie → keins (`lib/cover-quelle.ts`). Läuft vor `baueMeta`, damit Hauptbestand,
 * Verschobene, Reihen und Meldungen dasselbe Bild sehen. Zählt im Protokoll je Herkunft.
 */
export function setzeCoverNachRegel(titles: Map<number, Title>): void {
  const zaehler = { TMDB: 0, AniList: 0, aniSearch: 0, keins: 0 }
  for (const t of titles.values()) {
    t.coverImage = coverFuer(t.id, t.coverImage)
    zaehler[herkunft(t.coverImage)]++
  }
  log(`Cover nach Regel TMDB → AniList → aniSearch: ${zaehler.TMDB} TMDB, ${zaehler.AniList} AniList, ${zaehler.aniSearch} aniSearch (eigene Kopie), ${zaehler.keins} ohne`)
}
