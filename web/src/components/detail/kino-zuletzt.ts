import { monthName } from '@shared/time.ts'
import type { berechneAntwort } from './antwort-berechnen.ts'

/** „2026-04“ → „April 2026“; ein Tag wird nie genannt. */
export function kinoMonatText(monat: string): string {
  const [jahr, mon] = monat.split('-').map(Number)
  return `${monthName(mon - 1)} ${jahr}`
}

/**
 * Nur zusätzlich zu einer belegten Synchro (ein Kinostart sagt nichts über die Fassung) und nicht unter einem Kino-Banner,
 * der den laufenden Kinostart schon nennt.
 */
export function fragtKinoZuletzt(antwort: ReturnType<typeof berechneAntwort>): boolean {
  return antwort?.art === 'film' && antwort.hatSynchro && !antwort.imKino
}
