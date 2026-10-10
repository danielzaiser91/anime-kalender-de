import { useState } from 'react'
import type { AppRoute } from './router.ts'

/**
 * **Die beiden Schalter der Datenbank** („Staffeln zusammenfassen“, „Anime ohne deutsche Synchro“). Die Adresse gewinnt (`staffeln=`, `ohne=`),
 * sonst gilt bei den Staffeln der gespeicherte Wert (Vorgabe an) und bei „ohne“ aus. Gespeichert wird nur, was jemand selbst umlegt — ein
 * geteilter Link überschreibt die Einstellung des Empfängers nicht.
 */
export function useDbSchalter(route: AppRoute, ersetze: (next: Partial<AppRoute>) => void) {
  const [gespeichert, setGespeichert] = useState(() => localStorage.getItem('groupSeasons') !== '0')
  const grouped = route.staffeln ?? gespeichert
  const zeigeOhneSynchro = route.ohne === true

  const setGrouped = (next: boolean) => {
    localStorage.setItem('groupSeasons', next ? '1' : '0')
    setGespeichert(next)
    ersetze({ staffeln: next })
  }
  const setZeigeOhneSynchro = (next: boolean) => ersetze({ ohne: next || undefined })

  return { grouped, setGrouped, zeigeOhneSynchro, setZeigeOhneSynchro }
}
