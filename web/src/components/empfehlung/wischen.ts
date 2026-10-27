import { useRef, useState, type PointerEvent } from 'react'

/** Weg in Pixeln, ab dem ein Wischen zählt; darunter federt die Szene zurück (Spezifikation 5). */
export const WISCH_SCHWELLE = 90
/** Was ein Wischweg bedeutet. */
export function wischRichtung(dx: number): 'links' | 'rechts' | undefined {
  if (dx <= -WISCH_SCHWELLE) return 'links'
  return dx >= WISCH_SCHWELLE ? 'rechts' : undefined
}

/** Deckkraft des Stempels „Nein“ (links) bzw. „Favorit“ (rechts): folgt dem Weg, voll bei der Schwelle. */
export const stempelDeckkraft = (dx: number, seite: 'links' | 'rechts'): number =>
  Math.min(1, Math.max(0, (seite === 'links' ? -dx : dx) / WISCH_SCHWELLE))

/** Wischen nach links/rechts auf einer Fläche; ein Tippen löst nichts aus. */
export function useWischen(handler: { links: () => void; rechts: () => void }) {
  const [dx, setDx] = useState(0)
  const start = useRef<number | undefined>(undefined)
  const ende = () => {
    if (start.current === undefined) return
    const richtung = wischRichtung(dx)
    start.current = undefined
    setDx(0)
    if (richtung === 'links') handler.links()
    else if (richtung === 'rechts') handler.rechts()
  }
  const ereignisse = {
    onPointerDown: (e: PointerEvent) => {
      start.current = e.clientX
      e.currentTarget.setPointerCapture?.(e.pointerId)
    },
    onPointerMove: (e: PointerEvent) => {
      if (start.current === undefined) return
      setDx(e.clientX - start.current)
    },
    onPointerUp: ende,
    onPointerCancel: () => {
      start.current = undefined
      setDx(0)
    },
  }
  return { dx, ziehend: start.current !== undefined && dx !== 0, ereignisse }
}
