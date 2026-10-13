import { useEffect, useState } from 'react'
import type { AppRoute } from './router.ts'

/**
 * **Die beiden Schalter der Datenbank** („Staffeln zusammenfassen“, „Anime ohne deutsche Synchro“). Die Adresse (`staffeln=`, `ohne=`) gilt
 * beim Öffnen und spiegelt den Stand der Sitzung; ein Wechsel Datenbank → Woche → Datenbank stellt ihn wieder her. Gespeichert (`localStorage`)
 * wird nur die Staffel-Einstellung und nur, wenn jemand selbst umlegt — ein geteilter Link überschreibt die des Empfängers nicht, er gilt
 * für diese Sitzung. „Ohne Synchro“ ist ein Merk-Werkzeug und bleibt bewusst nur für die Sitzung.
 */
export function useDbSchalter(route: AppRoute, ersetze: (next: Partial<AppRoute>) => void) {
  // Vorgabe aus (Daniel, 13.10.2026): jede Staffel als eigene Kachel; nur ein gespeichertes '1' schaltet es ein.
  const [staffeln, setStaffeln] = useState(() => localStorage.getItem('groupSeasons') === '1')
  const [ohne, setOhne] = useState(false)
  const imDb = route.view === 'datenbank'

  useEffect(() => {
    if (!imDb) return
    // Ein Link gilt als Stand der Sitzung; fehlt der Wert in der Adresse, wird sie aus dem Stand ergänzt.
    if (route.staffeln !== undefined) setStaffeln(route.staffeln)
    if (route.ohne) setOhne(true)
    const fehlt: Partial<AppRoute> = {}
    if (route.staffeln === undefined && staffeln) fehlt.staffeln = true
    if (!route.ohne && ohne) fehlt.ohne = true
    if (Object.keys(fehlt).length) ersetze(fehlt)
  }, [imDb, route.staffeln, route.ohne])

  const setGrouped = (next: boolean) => {
    localStorage.setItem('groupSeasons', next ? '1' : '0')
    setStaffeln(next)
    ersetze({ staffeln: next })
  }
  const setZeigeOhneSynchro = (next: boolean) => {
    setOhne(next)
    ersetze({ ohne: next || undefined })
  }

  return { grouped: route.staffeln ?? staffeln, setGrouped, zeigeOhneSynchro: route.ohne ?? ohne, setZeigeOhneSynchro }
}
