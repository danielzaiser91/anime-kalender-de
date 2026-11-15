/** Rückgang der Titel mit Streaming-Weg gegenüber dem letzten Messwert (Warnung ab mehr als 1 %). */
export const RUECKGANG_SCHWELLE = 0.01

/** Ablage des Qualitätsverlaufs (Schreiber: `check-qualitaet.ts`). */
export const VERLAUF_DATEI = 'data/qualitaet-verlauf.json'

/** Präfix der Zeile, die der Workflow-Schritt „Datenqualität messen“ liest. */
export const RUECKGANG_ZEILE = 'STREAMING_RUECKGANG '

export function streamingRueckgang(aktuell: number, vorher: number | undefined): string | null {
  if (!vorher || vorher <= 0) return null
  const fall = vorher - aktuell
  if (fall <= 0 || fall / vorher <= RUECKGANG_SCHWELLE) return null
  return `mitStreamingWeg: ${vorher} → ${aktuell} (−${fall}, mehr als ${RUECKGANG_SCHWELLE * 100} % weniger als beim letzten Wert)`
}
