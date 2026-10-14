/** Das Tageskontingent von D1: Erkennen, wann es verweigert wird, und Sekunden bis zur Rücksetzung. */

/** Sekunden bis 00:00 UTC, wann D1 das Kontingent zurücksetzt (mindestens 1). */
export function sekundenBisMitternachtUtc(jetzt: Date): number {
  const morgen = Date.UTC(jetzt.getUTCFullYear(), jetzt.getUTCMonth(), jetzt.getUTCDate() + 1)
  return Math.max(1, Math.ceil((morgen - jetzt.getTime()) / 1000))
}

/**
 * Der Fehler, mit dem D1 nach dem echten Tageskontingent antwortet, z. B.
 * `D1_ERROR: Your account has exceeded D1's free tier daily row read limit.` (Wortlaut vom 01.09.2026,
 * docs/wissen/betrieb.md; der Schreib-Fall ist nach demselben Muster angenommen, nicht belegt).
 */
export function istD1Tageslimit(e: unknown): boolean {
  return /free tier daily row (read|write)|daily row (read|write)s? limit/i.test(String((e as Error)?.message ?? e))
}
