import { useEffect } from 'react'
import { LEAD_PX } from './woche-sprung.ts'

/**
 * **Ein Klick auf einen Tag im Monat springt in der Woche zu diesem Tag** (Daniel, 26.09.2026). Der
 * Monat merkt sich das Ziel, bevor er zur Woche wechselt; die Woche holt es nach dem Zeichnen ab.
 * Eine Modulvariable statt der Adresse: Das Ziel ist ein einmaliger Sprung, keine Ansicht.
 */
let zielTag: string | undefined

export function merkeZielTag(datum: string): void {
  zielTag = datum
}

export function useZielTag(tage: string[]): void {
  const schluessel = tage.join()
  useEffect(() => {
    const ziel = zielTag
    if (!ziel || !schluessel.includes(ziel)) return
    zielTag = undefined
    const el = document.querySelector<HTMLElement>(`section[data-datum="${ziel}"]`)
    if (!el) return
    const kopf = document.querySelector('header')
    const abstand = (kopf?.getBoundingClientRect().height ?? 0) + LEAD_PX / 2
    window.scrollTo({
      top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - abstand),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }, [schluessel])
}
