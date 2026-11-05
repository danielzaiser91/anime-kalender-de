import { useLayoutEffect, useRef } from 'react'

/**
 * Beim Wechsel der Ansicht (Woche <-> Monat) vor dem Zeichnen nach oben.
 * Der Monat ist viel kürzer als die Woche: Wer unten in der Woche steht, würde sonst vom Browser
 * auf das Seitenende geklemmt, und Fuß und Inhalt springen sichtbar (CLS 0,25 am Handy).
 */
export function useAnsichtOben(ansicht: string): void {
  const vorher = useRef(ansicht)
  useLayoutEffect(() => {
    if (vorher.current === ansicht) return
    vorher.current = ansicht
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [ansicht])
}
