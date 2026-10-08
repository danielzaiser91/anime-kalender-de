import { useEffect, useState } from 'react'

/**
 * Vorschauen `db-reserve` und `startgeruest`: Eine Liste steht erst, wenn ihr erstes Ergebnis aus den vollständigen Daten gerechnet ist.
 * Davor zeigte sie kurz einen Zwischenstand (leere Woche, wenige Kalender-Titel) und sprang dann. Nur beim ersten Mal — spätere Filter behalten die Liste.
 */
export function useErstesErgebnis(datenDa: boolean, ergebnisVeraltet: boolean): boolean {
  const [bereit, setBereit] = useState(false)
  useEffect(() => {
    if (datenDa && !ergebnisVeraltet) setBereit(true)
  }, [datenDa, ergebnisVeraltet])
  return bereit
}
