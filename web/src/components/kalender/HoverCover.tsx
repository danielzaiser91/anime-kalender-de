import { useEffect, useRef, useState } from 'react'
import type { PointerEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { coverBild } from '../../lib/cover.ts'
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
  const frist = useRef<number>(undefined)
  const weg = () => {
    window.clearTimeout(frist.current)
    setLage(undefined)
  }
  useEffect(() => {
    if (!lage) return
    /* Die Karte steht `fixed` — rollt die Seite, gehört sie nicht mehr zu ihrer Zeile. */
    window.addEventListener('scroll', weg, true)
    return () => window.removeEventListener('scroll', weg, true)
  }, [lage])
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
        frist.current = window.setTimeout(() => setLage(vorschauLage(zeile, x, { breite: window.innerWidth, hoehe: window.innerHeight })), VORSCHAU_FRIST_MS)
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
