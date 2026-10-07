import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

/**
 * Läuft der Inhalt des Elements über seine Breite hinaus? Dann braucht eine Leiste Pfeile — passt alles hinein, täten sie nichts
 * (Daniel, 07.10.2026, Kinoleiste in den News). `neuMessen` ändert sich, wenn sich der Inhalt ändert.
 */
export function useUeberlaeuft(ref: RefObject<HTMLElement | null>, neuMessen: unknown): boolean {
  const [ueberlaeuft, setUeberlaeuft] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const messen = () => setUeberlaeuft(el.scrollWidth > el.clientWidth + 1)
    messen()
    const beobachter = new ResizeObserver(messen)
    beobachter.observe(el)
    return () => beobachter.disconnect()
  }, [ref, neuMessen])
  return ueberlaeuft
}
