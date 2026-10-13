/**
 * Der ausgelieferte Bestand, wie er beim Start des Baus lag. Der Bau überschreibt `public/data/` erst spät (13-3); wer „vorher gegen nachher“
 * vergleicht, liest von hier, nicht von der Datei. `build.ts` merkt ihn als Erstes; ohne diesen Aufruf (Prüfskripte) bleibt die Liste leer.
 * Nicht beim Import lesen: `check:logic` darf `public/data` nicht anfassen (`tools/bestand-sperre.cjs`).
 */
import type { Title } from '../../shared/types.ts'
import { readJson } from './util.ts'

let vorher: readonly Title[] = []

function ladeListe(datei: string): Title[] {
  const roh = readJson<Title[] | Record<string, Title>>(`public/data/${datei}`, [])
  return Array.isArray(roh) ? roh : Object.values(roh)
}

/** Haupt- und Schalter-Datei (`titles.json`, `ohne-synchro.json`) jetzt lesen und festhalten. */
export function merkeBestandVorher(): void {
  vorher = [...ladeListe('titles.json'), ...ladeListe('ohne-synchro.json')]
}

export const bestandVorher = (): readonly Title[] => vorher
