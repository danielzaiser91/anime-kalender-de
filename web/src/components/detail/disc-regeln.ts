import type { DiscAusgabe } from '@shared/types.ts'

/**
 * Welche Disc-Ausgaben hinter dem Aufklapper „Einzelne Ausgaben" stehen: Teile einer Reihe, Einzelausgaben neben einer Gesamtausgabe — und Einzelausgaben, die es mehrfach je Format gibt
 * (Boxen ohne Gesamtausgabe: One Piece hat 20, bis 05.10.2026 war keine davon erreichbar). Eine einzelne Film-Ausgabe bleibt ohne Aufklapper.
 */
export function einzelneAusgaben(ausgaben: DiscAusgabe[]): DiscAusgabe[] {
  return ausgaben.filter(
    (a) =>
      a[2] === 't' ||
      (a[2] === 'e' && (ausgaben.some((b) => b[1] === a[1] && b[2] === 'g') || ausgaben.filter((b) => b[1] === a[1] && b[2] === 'e').length > 1)),
  )
}
