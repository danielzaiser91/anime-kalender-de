/** Rückgang der Titel mit Streaming-Weg gegenüber dem letzten Messwert (Warnung ab mehr als 1 %). */
export const RUECKGANG_SCHWELLE = 0.01

export function streamingRueckgang(aktuell: number, vorher: number | undefined): string | null {
  if (!vorher || vorher <= 0) return null
  const fall = vorher - aktuell
  if (fall <= 0 || fall / vorher <= RUECKGANG_SCHWELLE) return null
  return `mitStreamingWeg: ${vorher} → ${aktuell} (−${fall}, mehr als ${RUECKGANG_SCHWELLE * 100} % weniger als beim letzten Wert)`
}
