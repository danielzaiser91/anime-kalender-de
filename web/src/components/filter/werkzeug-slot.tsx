import { createContext, useContext, useState, type ReactNode, type RefObject } from 'react'
import { useEinrollen } from '../../lib/use-einrollen.ts'
import { useMobil } from '../../lib/use-mobil.ts'

interface Slot {
  element: HTMLElement | null
  setElement: (el: HTMLElement | null) => void
}

const SlotContext = createContext<Slot>({ element: null, setElement: () => {} })

/** Hält das Element in der Kopfleiste (Handy), in das die Werkzeugleiste der Ansicht per Portal rendert. */
export function WerkzeugSlotProvider({ children }: { children: ReactNode }) {
  const [element, setElement] = useState<HTMLElement | null>(null)
  return <SlotContext.Provider value={{ element, setElement }}>{children}</SlotContext.Provider>
}

export const useWerkzeugSlot = () => useContext(SlotContext)

/**
 * Für die Kopfleiste: Auf dem Handy gibt es in Kalender und Datenbank einen Slot für die Werkzeugleiste, und die Leiste
 * rollt beim Scrollen ein. Am Rechner bleibt das DOM unverändert (`mitSlot` falsch, nichts eingerollt).
 */
export function useKopfWerkzeug(kopf: RefObject<HTMLElement | null>, view: string, bereich: string | undefined) {
  const mobil = useMobil()
  const { setElement } = useWerkzeugSlot()
  useEinrollen(kopf, mobil, view)
  return { mitSlot: mobil && (bereich === 'kalender' || bereich === 'datenbank'), slotRef: setElement }
}
