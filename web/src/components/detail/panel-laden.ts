import { useEffect, useRef, useState } from 'react'
import type { DiscAusgabe } from '@shared/types.ts'
import { ladeTitelBestand, loadDiscAusgaben, type Dataset } from '../../lib/data.ts'

/** Die Disc-Ausgaben des Titels; beim Titelwechsel zuerst leer, eine verspätete Antwort des alten Titels zählt nicht. */
export function useDiscAusgaben(titleId: number): DiscAusgabe[] {
  const [discAusgaben, setDiscAusgaben] = useState<DiscAusgabe[]>([])
  useEffect(() => {
    let alive = true
    setDiscAusgaben([])
    loadDiscAusgaben(titleId)
      .then((a) => {
        if (alive) setDiscAusgaben(a)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [titleId])
  return discAusgaben
}

/**
 * **Ein Titel, den der Kern nicht kennt, wird nachgeladen.** `titles-core.json` führt nur, worauf
 * ein Termin zeigt — beim Einstieg über eine geteilte Adresse fehlt sonst das Panel.
 * Genau einmal je Kennung (`versucht`), damit ein wirklich unbekannter Titel nicht in eine Schleife läuft.
 */
export function useTitelNachladen(data: Dataset, titleId: number): boolean {
  const [holt, setHolt] = useState(false)
  const versucht = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (data.titleById.has(titleId) || versucht.current === titleId) return
    versucht.current = titleId
    setHolt(true)
    ladeTitelBestand(data, titleId)
      .catch(() => {})
      .finally(() => setHolt(false))
  }, [data, titleId])
  return holt
}

/**
 * Wechsel auf einen anderen Reihenteil. Fehlen dessen Metadaten (Katalogteil ohne belegte
 * Synchro), erst beide Bestände holen, dann öffnen — sonst zeigt das Panel „keine Metadaten".
 * Die Ladewege sind gegen Mehrfachaufrufe gesichert, das kostet nur beim ersten Wechsel.
 */
export function useReihenWechsel(data: Dataset, titleId: number, onOpenTitle: (id: number) => void) {
  const [wechselt, setWechselt] = useState(false)
  const wechsleZu = (id: number) => {
    if (id === titleId) return
    if (data.titleById.has(id)) {
      onOpenTitle(id)
      return
    }
    setWechselt(true)
    ladeTitelBestand(data, id)
      .catch(() => {})
      .finally(() => {
        setWechselt(false)
        onOpenTitle(id)
      })
  }
  return { wechselt, wechsleZu }
}
