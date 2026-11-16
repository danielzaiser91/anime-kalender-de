import type { Title } from '../../shared/types.ts'

/** Präfix der Zeile, die der Workflow-Schritt „Datenqualität messen“ (bestand-bauen.yml) liest. */
export const ERSTAUSGABE_OHNE_WEG_ZEILE = 'ERSTAUSGABE_OHNE_WEG '

/**
 * Titel, deren deutsche Erstausgabe als Synchro bekannt ist, die aber weder Stream noch Verweis tragen: Das Panel sagt dort „gab es auf Deutsch“,
 * aber nicht wo (Anlass 16.11.2026: Laughing Under the Clouds: Gaiden, Disc bei Amazon und aniSearch bekannt, am Titel nichts).
 */
export function zaehleErstausgabeOhneWeg(titles: Pick<Title, 'deErstausgabe' | 'streams' | 'watchLinks'>[]): number {
  return titles.filter((t) => t.deErstausgabe?.synchro === true && !(t.streams ?? []).length && !(t.watchLinks ?? []).length).length
}

/** Jeder Anstieg gegenüber dem letzten Messwert ist eine Zeile; ohne früheren Wert (ältere Verlaufszeile) keine. */
export function erstausgabeOhneWegAnstieg(aktuell: number, vorher: number | undefined): string | null {
  if (vorher === undefined || aktuell <= vorher) return null
  return `erstausgabeOhneWeg: ${vorher} → ${aktuell} (+${aktuell - vorher})`
}
