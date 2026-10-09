import { useEffect, useRef, useState } from 'react'
import type { ViewId } from '../lib/router.ts'
import { useLang } from '../lib/i18n.tsx'
import { Suchfeld } from './Suchfeld.tsx'
import { SuchZeichen } from './kalender/Zeichen.tsx'

/**
 * **Die Suche in der Kopfleiste.** Gesucht wird nur in der Datenbank; im Kalender gibt es kein Feld, das Symbol führt
 * dorthin (Daniel, 09.10.2026). Der Fokus überlebt den Seitenwechsel: iOS öffnet die Tastatur nur, wenn `focus()` im
 * Tipp selbst läuft. Im Tipp bekommt deshalb ein unsichtbares Feld den Fokus, und sobald das echte Suchfeld der
 * Datenbank steht, übernimmt es ihn.
 */
let platzhalterFeld: HTMLInputElement | undefined

function fokusVormerken(): void {
  platzhalterFeld?.remove()
  platzhalterFeld = document.createElement('input')
  platzhalterFeld.setAttribute('aria-hidden', 'true')
  platzhalterFeld.tabIndex = -1
  platzhalterFeld.style.cssText = 'position:fixed;top:0;left:0;opacity:0;width:1px;height:1px;font-size:16px;pointer-events:none'
  document.body.appendChild(platzhalterFeld)
  platzhalterFeld.focus()
}

function fokusUebernehmen(kopf: HTMLElement | null): void {
  const felder = kopf?.querySelectorAll<HTMLInputElement>('input[type="search"]') ?? []
  Array.from(felder).find((f) => f.offsetParent !== null)?.focus()
  platzhalterFeld?.remove()
  platzhalterFeld = undefined
}

/** Zustand der Kopf-Suche: aufgeklapptes Handy-Feld, Fokuswunsch nach dem Sprung in die Datenbank, Klick auf das Symbol. */
export function useKopfSuche(view: ViewId, kalender: boolean, suche: string, zurSuche: () => void) {
  const [sucheAuf, setSucheAuf] = useState(false)
  const [fokusWunsch, setFokusWunsch] = useState(false)
  const eingabe = useRef<HTMLInputElement>(null)
  const kopf = useRef<HTMLElement>(null)
  useEffect(() => {
    if (sucheAuf) eingabe.current?.focus()
  }, [sucheAuf])
  /* Beim Seitenwechsel klappt ein leeres Feld zu (sonst bleibt die Kopfzeile auf jeder Seite 56 px höher). */
  useEffect(() => {
    if (!suche && !fokusWunsch) setSucheAuf(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur der Wechsel der Ansicht zählt
  }, [view])
  /* Die Datenbank steht: Feld aufklappen (Handy), dann das sichtbare Suchfeld fokussieren. */
  useEffect(() => {
    if (!fokusWunsch || view !== 'datenbank') return
    if (!sucheAuf) return setSucheAuf(true)
    fokusUebernehmen(kopf.current)
    setFokusWunsch(false)
  }, [fokusWunsch, view, sucheAuf])
  const oeffnen = () => {
    if (!kalender) return setSucheAuf(!sucheAuf)
    fokusVormerken()
    setFokusWunsch(true)
    zurSuche()
  }
  return { sucheAuf, eingabe, kopf, oeffnen }
}

const FELD = 'h-11 w-full rounded-full border border-ak-rand bg-ak-flaeche pr-24 pl-10 text-sm text-ak-text placeholder:text-ak-sehr-leise focus:border-ak-akzent focus:outline-none'

/** Das Suchfeld mit Lupe; `className` setzt die Breite/Sichtbarkeit des Rahmens. */
export function KopfSuchfeld({
  suche,
  setSuche,
  className,
  eingabe,
}: {
  suche: string
  setSuche: (s: string) => void
  className: string
  eingabe?: React.Ref<HTMLInputElement>
}) {
  const { t } = useLang()
  return (
    <label className={`relative ${className}`}>
      <span className="pointer-events-none absolute top-1/2 left-3.5 z-10 -translate-y-1/2 text-ak-leise"><SuchZeichen /></span>
      <Suchfeld wert={suche} setzen={setSuche} platzhalter={t('kopf.suche')} className={FELD} eingabe={eingabe} />
    </label>
  )
}
