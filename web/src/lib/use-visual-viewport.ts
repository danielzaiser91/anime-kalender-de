import { useEffect, useState } from 'react'

/** Höhe des sichtbaren Bereichs (schrumpft mit der Tastatur), solange `aktiv`. */
export function useVisualViewportHoehe(aktiv: boolean): number {
  const lesen = () => window.visualViewport?.height ?? window.innerHeight
  const [hoehe, setHoehe] = useState(lesen)
  useEffect(() => {
    if (!aktiv) return
    const vv = window.visualViewport
    const neu = () => setHoehe(lesen())
    neu()
    vv?.addEventListener('resize', neu)
    window.addEventListener('resize', neu)
    return () => {
      vv?.removeEventListener('resize', neu)
      window.removeEventListener('resize', neu)
    }
  }, [aktiv])
  return hoehe
}
