/**
 * Titel mit mehreren Netflix-Kennungen aus verschiedenen Quellen (Datensatz, aniSearch, JustWatch): jede Kennung ist ein
 * eigenes Prüfziel der Erweiterung. Der Datensatz kennt nur seine eigene; die übrigen kommen hier dazu, je Titel ohne
 * Doppelungen und ohne die schon geführten.
 */
import { abweichendeNetflixKennungen, type QuellenDateien, type QuellenTitel } from './netflix-quellen-abweichung.ts'

/** Titelkennung → Netflix-Kennungen, die der Datensatz nicht führt (sortiert, ohne Doppelte). Titel ohne eigenen Netflix-Verweis fehlen. */
export function zusaetzlicheNetflixKennungen(titel: QuellenTitel[], dateien: QuellenDateien): Map<number, string[]> {
  const zusatz = new Map<number, string[]>()
  for (const f of abweichendeNetflixKennungen(titel, dateien)) {
    if (!f.kennungen.datensatz.length) continue
    const fremde = [...new Set([...f.kennungen.anisearch, ...f.kennungen.justwatch])].filter((k) => !f.kennungen.datensatz.includes(k)).sort()
    if (fremde.length) zusatz.set(f.id, fremde)
  }
  return zusatz
}
