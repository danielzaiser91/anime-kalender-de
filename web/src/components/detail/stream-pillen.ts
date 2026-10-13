/**
 * **Welche Stream-Pillen stehen, solange noch nichts erschienen ist.**
 *
 * Streamwege verschwinden dann (Apothekerin Staffel 3: Crunchyroll führt noch keine Folge,
 * Daniel 04.09.2026). Stattdessen stehen die Termin-Pillen (`ReleasePille`: Sender oder Anbieter
 * mit Datum) — „nicht nur wann, auch wo". Bei „YAIBA: Samurai Legend" (TV ab 05.11.2026) fehlte
 * der Termin und „Stream" stand ausgegraut (Daniel, 10.10.2026); Abo-Termine wie „Cyberpunk:
 * Edgerunners 2" (Netflix 20.10.) ebenso.
 */
import type { ReactElement, ReactNode } from 'react'

export type Gruppe = 'frei' | 'abo' | 'kauf' | 'tv' | 'unbekannt' | 'offen'

/** Die Zugangsgruppe einer Pille, über ihren `key`; unbekannte Pillen sind „sonst". */
export function gruppeVon(gruppen: Map<string, Gruppe>, p: ReactNode): Gruppe | 'sonst' {
  return gruppen.get(String((p as ReactElement)?.key ?? '')) ?? 'sonst'
}

export function sichtbareStreamPillen(stream: ReactNode[], termine: ReactNode[], nochNichts: boolean): ReactNode[] {
  return nochNichts ? termine : stream
}
