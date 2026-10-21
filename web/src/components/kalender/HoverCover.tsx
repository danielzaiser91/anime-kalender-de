import { useEffect, useRef, useState } from 'react'
import type { PointerEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { coverBild } from '../../lib/cover.ts'
import { sichtbareBreite } from '../../lib/sichtbare-breite.ts'
import { VORSCHAU_BREITE, VORSCHAU_FRIST_MS, VORSCHAU_HOEHE, vorschauLage, zeigtVorschau, type VorschauLage } from '../../lib/hover-cover.ts'

/**
 * Cover-Vorschau für eine Listenzeile: `zeiger` an die Zeile hängen, `vorschau` irgendwo daneben ausgeben.
 * Das Bild gibt es erst, wenn eine Maus kurz auf der Zeile ruht — am Handy und bei schnellem Durchfahren
 * wird nichts geladen. Die Karte ist rein dekorativ (aria-hidden) und fängt keine Zeigerereignisse ab.
 */
export function useHoverCover(cover: string | undefined): {
  zeiger: {
    'data-hover-zeile'?: string
    onPointerEnter?: (e: PointerEvent<HTMLElement>) => void
    onPointerLeave?: () => void
    onPointerDown?: () => void
  }
  vorschau: ReactNode
} {
  const [lage, setLage] = useState<VorschauLage>()
  const [wartet, setWartet] = useState(false)
  const frist = useRef<number>(undefined)
  const weg = () => {
    window.clearTimeout(frist.current)
    setWartet(false)
    setLage(undefined)
  }
  useEffect(() => {
    if (!wartet) return
    /* Ab Fristbeginn: Rollen schiebt Zeilen unter den ruhenden Zeiger (Chrome schickt dann `pointerenter` an andere Zeilen),
       und die Karte steht `fixed`. Fensterwechsel schließt sie ebenso. */
    const schliesse = () => weg()
    const schliesseVerdeckt = () => document.hidden && weg()
    window.addEventListener('scroll', schliesse, { capture: true, passive: true })
    window.addEventListener('blur', schliesse)
    document.addEventListener('visibilitychange', schliesseVerdeckt)
    return () => {
      window.removeEventListener('scroll', schliesse, true)
      window.removeEventListener('blur', schliesse)
      document.removeEventListener('visibilitychange', schliesseVerdeckt)
    }
  }, [wartet])
  useEffect(() => () => window.clearTimeout(frist.current), [])
  if (!cover) return { zeiger: {}, vorschau: null }
  return {
    zeiger: {
      'data-hover-zeile': '',
      onPointerEnter: (e) => {
        if (!zeigtVorschau(e.pointerType)) return
        const zeile = e.currentTarget.getBoundingClientRect()
        const x = e.clientX
        window.clearTimeout(frist.current)
        setWartet(true)
        frist.current = window.setTimeout(() => setLage(vorschauLage(zeile, x, { breite: sichtbareBreite(), hoehe: window.innerHeight })), VORSCHAU_FRIST_MS)
      },
      onPointerLeave: weg,
      /* Ein Klick öffnet das Panel — die Vorschau hat ihren Zweck erfüllt. */
      onPointerDown: weg,
    },
    vorschau: lage ? createPortal(<VorschauKarte cover={cover} lage={lage} />, document.body) : null,
  }
}

function VorschauKarte({ cover, lage }: { cover: string; lage: VorschauLage }) {
  return (
    <div
      data-hover-cover
      aria-hidden="true"
      style={{ left: lage.left, top: lage.top, width: VORSCHAU_BREITE, height: VORSCHAU_HOEHE }}
      className="pointer-events-none fixed z-[60] overflow-hidden rounded-lg border border-ak-rand bg-ak-flaeche-2 shadow-[0_18px_40px_rgba(0,0,0,.45)]"
    >
      <img {...coverBild(cover, VORSCHAU_BREITE)} alt="" width={VORSCHAU_BREITE} height={VORSCHAU_HOEHE} decoding="async" className="size-full object-cover" />
    </div>
  )
}
