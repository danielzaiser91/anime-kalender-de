/** Die Nachlade-Pakete (Detailpanel, Filterfeld, Monat, Einstellungen) liegen im Leerlauf bereit, damit das erste Tippen nicht wartet. */
const PAKETE: Array<() => Promise<unknown>> = [
  () => import('../components/DetailPanel.tsx'),
  () => import('../components/kalender/FilterFeld.tsx'),
  () => import('../components/MonthView.tsx'),
  () => import('../components/Einstellungen.tsx'),
]

interface Leitung {
  saveData?: boolean
  effectiveType?: string
}

/** Auf knapper Leitung (Datensparmodus, 2G/3G) wird nichts vorab geladen. */
export function leitungKnapp(leitung: Leitung | undefined): boolean {
  return Boolean(leitung?.saveData) || /^(slow-2g|2g|3g)$/.test(leitung?.effectiveType ?? '')
}

/** Startet das Vorwärmen nach dem ersten Bild, ein Paket je Leerlauf; gibt die Abbruchfunktion zurück. */
export function nachladeVorwaermen(
  pakete: Array<() => Promise<unknown>> = PAKETE,
  leitung: Leitung | undefined = (navigator as Navigator & { connection?: Leitung }).connection,
): () => void {
  if (leitungKnapp(leitung)) return () => {}
  let abgebrochen = false
  let marke: number | undefined
  const weiter = (i: number) => {
    if (abgebrochen || i >= pakete.length) return
    const los = () => {
      if (abgebrochen) return
      pakete[i]().catch(() => {}).finally(() => weiter(i + 1))
    }
    /* Safari kennt requestIdleCallback nicht. */
    marke = typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(los, { timeout: 4000 }) : window.setTimeout(los, 1500)
  }
  weiter(0)
  return () => {
    abgebrochen = true
    if (marke !== undefined && 'cancelIdleCallback' in window) window.cancelIdleCallback(marke)
  }
}
