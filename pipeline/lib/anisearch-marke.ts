/**
 * **Die Marke „Deutsch“ bei aniSearch je Titel — ein Leser für alle Stellen des Baus.**
 *
 * `d` vertont, `p` geplant, `c` abgebrochen, `-` nicht genannt. Alle drei Dateien stammen aus derselben Antwort der aniSearch-Schnittstelle
 * (`/v1/anime/dubs`, `fetch-anisearch-dubs.ts`; die Einträge laut `?lang=de`, `fetch-anisearch-eintraege.ts`, tragen dieselbe Marke: 8.274 von 8.274
 * gleich, 11.10.2026). Sie unterscheiden sich nur in der Abdeckung:
 *
 * - `data/anisearch-dub-ids.json`: aniSearch-Kennung → Marke, **alle** Einträge mit Deutsch. Das ist die Wahrheit.
 * - `data/anisearch-dubs.json`: Titel-Kennung → Marke, der Auszug für die Titel, die zum Abrufzeitpunkt eine aniSearch-Kennung hatten. Er kennt als
 *   einziger das `-`, veraltet aber, sobald die Brücke nach dem Abruf wächst (gleicher Abruf, gleiche Liste, also kann der Titel nur gefehlt haben): Psyren,
 *   Hyouken II, Vermilion Mask und Firefly Wedding (alle `p`) und fünf Titel mit `d` fehlten am 11.10.2026.
 *
 * Wer die Marke eines Titels braucht, geht durch `deutschMarke`: Der Auszug gilt, und wo er den Titel nicht kennt, die Liste über die Brücke.
 */
import { readJson } from './util.ts'
import { anisearchBruecke } from './anisearch-katalog-ids.ts'

let dubs: Record<string, string> | undefined
let dubIds: Record<string, string> | undefined

/** aniSearch-Kennung → Marke; nur Einträge mit Deutsch (`data/anisearch-dub-ids.json`). */
export const dubIdsNachAnisearch = (): Record<string, string> => (dubIds ??= readJson<Record<string, string>>('data/anisearch-dub-ids.json', {}))

/** Titel-Kennung → Marke: der Auszug, ergänzt um die Titel, deren Kennung die Brücke kennt und die Liste mit Deutsch führt. */
export function dubsNachTitel(): Record<string, string> {
  if (dubs) return dubs
  const ergaenzt: Record<string, string> = {}
  for (const [titel, anisearch] of anisearchBruecke()) {
    const marke = dubIdsNachAnisearch()[anisearch]
    if (marke) ergaenzt[titel] = marke
  }
  return (dubs = { ...ergaenzt, ...readJson<Record<string, string>>('data/anisearch-dubs.json', {}) })
}

/** Nur für Prüfungen: ersetzt die Marken durch eigene Daten (`undefined` stellt die Sammlerdateien wieder her). */
export function setzeMarkenFuerPruefung(marken: Record<string, string> | undefined): void {
  dubs = marken
}

/** Die Marke eines Titels; `undefined`, wo aniSearch zu ihm nichts liefert. */
export const deutschMarke = (titelId: number): string | undefined => dubsNachTitel()[String(titelId)]

/**
 * Zieht das Feld `dub` jedes Eintrags auf die Liste nach (die Wahrheit, s. o.): Der Eintrag hält die Marke vom Abruf, die Liste ändert sich täglich
 * (18892 wurde am 17.10.2026 von „nicht genannt" zu „geplant"). Nur was in der Antwort steht, zählt: Fehlt eine Kennung dort (die Antwort deckt nicht alles ab), ist ihr Deutsch nicht widerlegt, der Eintrag bleibt. Gibt die Zahl der geänderten Einträge zurück.
 */
export function zieheMarkeNach(eintraege: Record<string, { dub: string }>, liste: Record<string, string>, antwort: Record<string, unknown>): number {
  let geaendert = 0
  for (const [id, eintrag] of Object.entries(eintraege)) {
    if (!(id in antwort)) continue
    const marke = liste[id] ?? '-'
    if (eintrag.dub === marke) continue
    eintrag.dub = marke
    geaendert++
  }
  return geaendert
}
