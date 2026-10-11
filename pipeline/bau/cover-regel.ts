import { log } from '../lib/util.ts'
import { coverNachRegel, ladeCoverQuellen, type CoverQuellen } from '../lib/cover-quelle.ts'
import { anisearchKennungen } from './anisearch-kennung.ts'
import type { Title } from '../../shared/types.ts'

let quellen: CoverQuellen | undefined
/** Einmal je Bau geladen (das Archiv zu lesen dauert einige Sekunden); der Katalog (`nebendateien.ts`) nutzt dieselben Quellen. */
export const coverQuellen = (): CoverQuellen => (quellen ??= ladeCoverQuellen())

/**
 * **Jeder Titel bekommt sein Cover nach der Regel** TMDB → aniSearch → keins (`lib/cover-quelle.ts`), gleich woher das Cover vorher kam.
 * Läuft vor `baueMeta`, damit Hauptbestand, Verschobene, Reihen und Meldungen dasselbe Bild sehen. Zählt im Protokoll je Herkunft.
 */
export function setzeCoverNachRegel(titles: Map<number, Title>): void {
  const q = coverQuellen()
  const kennungen = anisearchKennungen([...titles.values()].map((t) => ({ id: t.id, mal: t.malId })))
  const zaehler = { TMDB: 0, aniSearch: 0, keins: 0 }
  for (const t of titles.values()) {
    t.coverImage = coverNachRegel(t.id, kennungen.get(t.id), q)
    zaehler[!t.coverImage ? 'keins' : t.coverImage.includes('tmdb.org') ? 'TMDB' : 'aniSearch']++
  }
  log(`Cover nach Regel TMDB → aniSearch: ${zaehler.TMDB} TMDB, ${zaehler.aniSearch} aniSearch, ${zaehler.keins} ohne (${q.anisearchOhne.size} Kennungen ohne eigenes Cover bei aniSearch)`)
}
