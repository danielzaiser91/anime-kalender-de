import { log } from '../lib/util.ts'
import { coverNachRegel, ladeTmdbPlakate, type TmdbPlakate } from '../lib/cover-quelle.ts'
import type { Title } from '../../shared/types.ts'

let plakate: TmdbPlakate | undefined
/** Einmal je Bau geladen; der Katalog (`nebendateien.ts`) nutzt dieselben Plakate. */
const tmdbPlakate = (): TmdbPlakate => (plakate ??= ladeTmdbPlakate())

/** Das Cover eines Titels nach der Regel; für Katalogzeilen und die Kopien in `verschoben`, die vor `setzeCoverNachRegel` entstanden. */
export const coverFuer = (titelId: number, bisher: string | undefined): string | undefined => coverNachRegel(titelId, bisher, tmdbPlakate())

/**
 * **Jeder Titel bekommt sein Cover nach der Regel** TMDB → AniList → keins (`lib/cover-quelle.ts`). Läuft vor `baueMeta`, damit Hauptbestand,
 * Verschobene, Reihen und Meldungen dasselbe Bild sehen. Zählt im Protokoll je Herkunft.
 */
export function setzeCoverNachRegel(titles: Map<number, Title>): void {
  const zaehler = { TMDB: 0, AniList: 0, keins: 0 }
  for (const t of titles.values()) {
    t.coverImage = coverFuer(t.id, t.coverImage)
    zaehler[!t.coverImage ? 'keins' : t.coverImage.includes('tmdb.org') ? 'TMDB' : 'AniList']++
  }
  log(`Cover nach Regel TMDB → AniList: ${zaehler.TMDB} TMDB, ${zaehler.AniList} AniList, ${zaehler.keins} ohne`)
}
