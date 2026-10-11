/**
 * **Die Marke „Deutsch“ bei aniSearch je Titel — ein Leser für alle Stellen des Baus.**
 *
 * `d` vertont, `p` geplant, `c` abgebrochen, `-` nicht genannt. Die Marke kommt aus der Dub-Liste der aniSearch-Schnittstelle
 * (`fetch-anisearch-dubs.ts`); wer sie liest, geht durch `deutschMarke`, nicht an die Datei.
 */
import { readJson } from './util.ts'

let dubs: Record<string, string> | undefined

/** Titel-Kennung → Marke (`data/anisearch-dubs.json`). */
export const dubsNachTitel = (): Record<string, string> => (dubs ??= readJson<Record<string, string>>('data/anisearch-dubs.json', {}))

/** Die Marke eines Titels; `undefined`, wo aniSearch zu ihm nichts liefert. */
export const deutschMarke = (titelId: number): string | undefined => dubsNachTitel()[String(titelId)]
