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

/**
 * Der Fehler, mit dem D1 jede Anfrage abweist, solange ein Export läuft
 * (`D1_ERROR: Currently processing a long-running export.`, Worker-Log vom 16.10.2026 21:38:45 UTC,
 * während des Laufs `meldungskopie.yml`). Vorübergehend: der zweite Klick ging durch.
 */
export function istD1Export(e: unknown): boolean {
  return /long-running export/i.test(String((e as Error)?.message ?? e))
}

/**
 * Wartezeit nach einer Export-Abweisung. Gemessen am 16.10.2026: Der Schritt „Kopie ziehen“ von
 * `meldungskopie.yml` lief 12 s (21:38:41 bis 21:38:53 UTC, drei Tabellen, 79.062 Zeilen); 30 s lassen
 * Raum für wachsende Tabellen.
 */
export const EXPORT_PAUSE_SEKUNDEN = 30

/** Der Satz für die Export-Abweisung (Erweiterung und Seite zeigen `error`). */
export const EXPORT_PAUSE_TEXT = 'Die Datenbank ist gerade kurz beschäftigt. Versuch es in einer halben Minute noch einmal.'

/** Verweigert D1 gerade vorübergehend (Export oder Tageslimit)? Dann gehen Teilergebnisse nicht still verloren, sondern die Anfrage scheitert. */
export function istD1Abweisung(e: unknown): boolean {
  return istD1Export(e) || istD1Tageslimit(e)
}
