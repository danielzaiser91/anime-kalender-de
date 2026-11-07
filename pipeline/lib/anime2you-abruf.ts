/** Fehlertext für die Quellen-Gesundheit, wenn ein Lauf null Vorschläge hat: Abrufausfall und ruhiger Tag sind verschiedene Befunde. `abrufFehler` zählt Feed-Abrufe, je Feed einer. */
export function leerGrund(abrufFehler: string[], feedAnzahl: number): string {
  if (abrufFehler.length === 0) return 'kein Feed-Eintrag mit Termin'
  if (abrufFehler.length >= feedAnzahl) return `Abruf gescheitert (alle Feeds): ${abrufFehler[0]}`
  return `kein Eintrag mit Termin; ${abrufFehler.length} von ${feedAnzahl} Feeds gescheitert: ${abrufFehler[0]}`
}
