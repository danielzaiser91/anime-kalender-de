import { useEffect, type RefObject } from 'react'

const SCHWELLE = 8
const NACHLAUF_MS = 1500

/**
 * Die Kopfleiste rollt beim Abwärtsscrollen ein und beim Hochscrollen wieder aus (`data-kopf-weg`, CSS in `styles.css`).
 * Nur Nutzer-Scroll zählt (Touch, Mausrad, Tasten) — ein Sprung per `scrollTo` lässt sie stehen. Oben auf der Seite,
 * bei offenem Filterfenster (`data-filter-offen`) und bei Fokus in der Leiste bleibt sie sichtbar.
 */
export function useEinrollen(kopf: RefObject<HTMLElement | null>, aktiv: boolean, ansicht: string): void {
  useEffect(() => {
    const el = kopf.current
    if (el) delete el.dataset.kopfWeg
  }, [kopf, ansicht, aktiv])
  useEffect(() => {
    const el = kopf.current
    if (!aktiv || !el) return
    let nutzer = false
    let timer: number | undefined
    let letzte = window.scrollY
    let summe = 0
    const nutzerScroll = (dauer: number) => {
      nutzer = true
      window.clearTimeout(timer)
      timer = window.setTimeout(() => (nutzer = false), dauer)
    }
    const sperre = () => el.dataset.filterOffen === '1' || (el.contains(document.activeElement) && document.activeElement instanceof HTMLInputElement)
    const scroll = () => {
      const y = window.scrollY
      const dy = y - letzte
      letzte = y
      if (y < el.offsetHeight || sperre()) {
        delete el.dataset.kopfWeg
        summe = 0
        return
      }
      if (!nutzer) return
      summe = Math.sign(dy) === Math.sign(summe) ? summe + dy : dy
      if (summe >= SCHWELLE) el.dataset.kopfWeg = '1'
      else if (summe <= -SCHWELLE) delete el.dataset.kopfWeg
    }
    const touchStart = () => nutzerScroll(60000)
    const touchEnd = () => nutzerScroll(NACHLAUF_MS)
    const rad = () => nutzerScroll(300)
    const taste = (e: KeyboardEvent) => ['PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', ' ', 'End', 'Home'].includes(e.key) && nutzerScroll(500)
    window.addEventListener('scroll', scroll, { passive: true })
    window.addEventListener('touchstart', touchStart, { passive: true })
    window.addEventListener('touchend', touchEnd, { passive: true })
    window.addEventListener('touchcancel', touchEnd, { passive: true })
    window.addEventListener('wheel', rad, { passive: true })
    window.addEventListener('keydown', taste)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('scroll', scroll)
      window.removeEventListener('touchstart', touchStart)
      window.removeEventListener('touchend', touchEnd)
      window.removeEventListener('touchcancel', touchEnd)
      window.removeEventListener('wheel', rad)
      window.removeEventListener('keydown', taste)
    }
  }, [kopf, aktiv])
}
