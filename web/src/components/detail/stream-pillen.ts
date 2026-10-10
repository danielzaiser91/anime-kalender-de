/**
 * **Welche Stream-Pillen bleiben, solange noch nichts erschienen ist.**
 *
 * Streamwege verschwinden dann (Apothekerin Staffel 3: Crunchyroll führt noch keine Folge,
 * Daniel 04.09.2026). Ein angekündigter Fernsehtermin ist dagegen kein Link zu einer leeren
 * Seite, sondern die Auskunft selbst — bei „YAIBA: Samurai Legend" (TV ab 05.11.2026) fehlte
 * er, und „Stream" stand ausgegraut (Daniel, 10.10.2026).
 */
import type { ReactElement, ReactNode } from 'react'

export type Gruppe = 'frei' | 'abo' | 'kauf' | 'tv' | 'unbekannt'

/** Die Zugangsgruppe einer Pille, über ihren `key`; unbekannte Pillen sind „sonst". */
export function gruppeVon(gruppen: Map<string, Gruppe>, p: ReactNode): Gruppe | 'sonst' {
  return gruppen.get(String((p as ReactElement)?.key ?? '')) ?? 'sonst'
}

export function sichtbareStreamPillen(
  stream: ReactNode[],
  nochNichts: boolean,
  gruppen: Map<string, Gruppe>,
): ReactNode[] {
  return nochNichts ? stream.filter((p) => gruppeVon(gruppen, p) === 'tv') : stream
}
