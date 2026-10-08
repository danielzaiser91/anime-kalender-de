import { useCallback, useEffect, useRef, useState } from 'react'
import { wocheDeckt } from '@shared/wochen-datei.ts'
import { loadDataset, loadWochenStart, type Dataset, type WochenStart } from './data.ts'
import type { AppRoute } from './router.ts'

/** Nach dem Wochen-Start längstens so lange, bis das Nachladen der vollen Daten beginnt (Bilder der ersten Karten haben Vorrang). */
const NACHLADEN_SPAETESTENS_MS = 6000
const BILD_PRUEFUNG_MS = 300
const BEDIENUNG = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const

/** Ob die Adresse die Wochenansicht ohne Suche meint — nur dann kann die Wochen-Datei reichen. */
const wochenansichtOhneSuche = (route: AppRoute): boolean => route.view === 'woche' && route.filters.search.trim() === ''

/** Beim Start zusätzlich ohne Panel: Ein geteilter Link auf einen Titel braucht die vollen Daten sofort. */
const wochenStartMoeglich = (route: AppRoute): boolean => wochenansichtOhneSuche(route) && route.title === undefined

/** Ob die Karten im Sichtfeld ihr Bild haben: Dann hat die Leitung Platz für die vollen Daten. */
function sichtbareBilderFertig(): boolean {
  const karten = [...document.querySelectorAll<HTMLImageElement>('article img')].filter((b) => {
    const r = b.getBoundingClientRect()
    return r.top < window.innerHeight && r.bottom > 0
  })
  return karten.length > 0 && karten.every((b) => b.complete)
}

/**
 * Plant das Nachladen der vollen Daten: sobald die sichtbaren Karten ihr Bild haben (spätestens nach 6 s), im Leerlauf — oder sofort,
 * wenn jemand die Seite bedient (Tippen, Scrollen, Taste). Gibt die Aufräumfunktion zurück.
 */
function planeNachladen(starte: () => void): () => void {
  const abbau: (() => void)[] = []
  const los = () => {
    abbau.forEach((a) => a())
    starte()
  }
  for (const ereignis of BEDIENUNG) {
    window.addEventListener(ereignis, los, { passive: true })
    abbau.push(() => window.removeEventListener(ereignis, los))
  }
  const begonnen = Date.now()
  const takt = window.setInterval(() => {
    if (!sichtbareBilderFertig() && Date.now() - begonnen < NACHLADEN_SPAETESTENS_MS) return
    window.clearInterval(takt)
    /* Safari kennt requestIdleCallback nicht. */
    const hatLeerlauf = 'requestIdleCallback' in window
    const leerlauf = hatLeerlauf ? window.requestIdleCallback(los, { timeout: 1500 }) : window.setTimeout(los, 100)
    abbau.push(() => (hatLeerlauf ? window.cancelIdleCallback(leerlauf) : window.clearTimeout(leerlauf)))
  }, BILD_PRUEFUNG_MS)
  abbau.push(() => window.clearInterval(takt))
  return () => abbau.forEach((a) => a())
}

/**
 * **Die Daten der App: erst die Woche, dann alles.**
 *
 * Die Wochenansicht startet aus `woche.json` (≈ 30 KB statt ≈ 317 KB) und lädt die vollen Dateien danach im Hintergrund (`planeNachladen`).
 * `data` ist die Wochen-Datei nur, solange sie für diese Ansicht reicht (Woche und heute in ihrer Woche, keine Suche, Wochenansicht);
 * jede andere Ansicht, jede Suche und jedes Panel warten auf `voll` und lösen das Laden sofort aus. Fehlt oder veraltet die
 * Wochen-Datei, läuft der Start wie vorher.
 */
export function useStartdaten(route: AppRoute, heute: string): { data?: Dataset; voll?: Dataset; error?: string } {
  const [voll, setVoll] = useState<Dataset>()
  const [teil, setTeil] = useState<WochenStart>()
  const [error, setError] = useState<string>()
  const geladen = useRef(false)
  const startRoute = useRef(route)

  const starteVoll = useCallback(() => {
    if (geladen.current) return
    geladen.current = true
    loadDataset()
      .then(setVoll)
      .catch((e: Error) => setError(e.message))
  }, [])

  useEffect(() => {
    const erste = startRoute.current
    /* Das Skript im Kopf der Seite hat schon entschieden, welche Dateien vorgeladen sind (`tools/vite-vorladen.ts`). */
    if (!wochenStartMoeglich(erste) || (window as { __akWoche?: boolean }).__akWoche === false) return starteVoll()
    loadWochenStart()
      .then((w) => (wocheDeckt(w, erste.date, heute) ? setTeil(w) : starteVoll()))
      .catch(starteVoll)
  }, [heute, starteVoll])

  const teilGueltig = teil !== undefined && wochenansichtOhneSuche(route) && wocheDeckt(teil, route.date, heute)
  const verlangtVoll = teil !== undefined && (!teilGueltig || route.title !== undefined)
  useEffect(() => {
    if (verlangtVoll) starteVoll()
  }, [verlangtVoll, starteVoll])
  useEffect(() => {
    if (!teil || voll) return
    return planeNachladen(starteVoll)
  }, [teil, voll, starteVoll])

  return { data: voll ?? (teilGueltig ? teil.data : undefined), voll, error }
}
