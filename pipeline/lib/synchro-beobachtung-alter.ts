/**
 * Alterswarnung der Beobachtungsliste: ein Eintrag, dessen Start länger als `WARN_TAGE` zurückliegt und der noch keinen Synchro-Beleg hat.
 * Schwelle gemessen am 12.11.2026 an `data/synchro-historie.json` und `releases.json` (Starts 01.09.–10.11.): von 14 Titeln, deren Synchro
 * erst am oder nach dem Starttag bekannt wurde, kamen 13 spätestens 5 Tage nach dem Start (0,0,0,0,0,1,1,1,1,2,2,4,5 und 26 Tage).
 */
import { diffDays } from '../../shared/time.ts'
import type { BeobachtungsEintrag } from './synchro-beobachtung.ts'

export const WARN_TAGE = 5

/** Eine Zeile je Eintrag mit Titel, Anbieter und Tagen seit dem Start, ältester Start zuerst (Eingabe ist nach Start sortiert). */
export function alterswarnungen(eintraege: BeobachtungsEintrag[], heute: string): string[] {
  return eintraege
    .filter((e) => diffDays(e.start, heute) > WARN_TAGE)
    .map((e) => `${e.titel} (${e.anbieter}): Start ${e.start}, seit ${diffDays(e.start, heute)} Tagen ohne Synchro-Beleg`)
}
