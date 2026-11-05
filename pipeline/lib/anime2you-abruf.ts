/** Fehlertext für die Quellen-Gesundheit, wenn ein Lauf null Vorschläge hat: Abrufausfall und ruhiger Tag sind verschiedene Befunde. */
export function leerGrund(abrufFehler: string[], feedAnzahl: number): string {
  if (abrufFehler.length === 0) return 'kein Feed-Eintrag mit Termin'
  const art = abrufFehler.length >= feedAnzahl ? 'alle' : `${abrufFehler.length} von ${feedAnzahl}`
  return `Abruf gescheitert (${art} Feeds): ${abrufFehler[0]}`
}
