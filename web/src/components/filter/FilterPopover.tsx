import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useVisualViewportHoehe } from '../../lib/use-visual-viewport.ts'
import { useVerlaufEintrag } from '../../lib/use-verlauf-eintrag.ts'
import { useWerkzeugSlot } from './werkzeug-slot.tsx'

/** Platz unter dem Popover: Handy-Navigation (78) und Luft (16). */
const UNTEN = 94

/**
 * Macht alles außer Leiste und Fenster `inert`: Tab, Klick und Vorlesen erreichen den Hintergrund nicht, solange das
 * Fenster offen ist. Gibt die Rücknahme zurück (nur, was hier gesperrt wurde).
 */
function hintergrundSperren(kopf: Element | null | undefined, slot: HTMLElement | null): () => void {
  const ziele: Element[] = []
  if (kopf) ziele.push(...Array.from(kopf.parentElement?.children ?? []).filter((e) => e !== kopf), ...Array.from(kopf.children).filter((e) => e !== slot))
  ziele.push(...Array.from(document.body.children).filter((e) => !e.contains(kopf ?? null) && !e.hasAttribute('data-schleier') && e.tagName !== 'SCRIPT'))
  const gesperrt = ziele.filter((e): e is HTMLElement => e instanceof HTMLElement && !e.inert)
  gesperrt.forEach((e) => (e.inert = true))
  return () => gesperrt.forEach((e) => (e.inert = false))
}

/**
 * Das Filterfenster der Werkzeugleiste: hängt 8 px unter der Leiste, scrollt in sich und nimmt höchstens den sichtbaren
 * Bereich bis zur Navigation (mit Tastatur kürzer). Kein Modal: dahinter liegt nur ein Schleier zum Wegtippen.
 * Escape und Zurück schließen; der Fokus geht hinein und beim Schließen zurück an den Auslöser.
 */
export function FilterPopover({ offen, schliessen, ausloeser, label, children }: {
  offen: boolean
  schliessen: () => void
  ausloeser: RefObject<HTMLElement | null>
  label: string
  children: ReactNode
}) {
  const { element: slot } = useWerkzeugSlot()
  const dialog = useRef<HTMLDivElement>(null)
  const zu = useRef(schliessen)
  zu.current = schliessen
  const hoehe = useVisualViewportHoehe(offen)
  useVerlaufEintrag(offen, schliessen)
  useEffect(() => {
    if (!offen) return
    const kopf = slot?.closest('header')
    if (kopf) kopf.dataset.filterOffen = '1'
    const html = document.documentElement
    const vorher = html.style.overflow
    html.style.overflow = 'hidden'
    const wieder = hintergrundSperren(kopf, slot)
    dialog.current?.focus()
    const taste = (e: KeyboardEvent) => e.key === 'Escape' && zu.current()
    window.addEventListener('keydown', taste)
    const knopf = ausloeser.current
    return () => {
      window.removeEventListener('keydown', taste)
      html.style.overflow = vorher
      wieder()
      if (kopf) delete kopf.dataset.filterOffen
      knopf?.focus()
    }
  }, [offen, slot, ausloeser])
  if (!offen || !slot) return null
  const oben = slot.getBoundingClientRect().bottom + 8
  return (
    <>
      {createPortal(<div data-schleier aria-hidden="true" onClick={schliessen} className="fixed inset-0 z-20 bg-black/30" />, document.body)}
      {createPortal(
        <div
          ref={dialog}
          id="ak-filter"
          role="dialog"
          aria-label={label}
          tabIndex={-1}
          style={{ maxHeight: Math.max(160, hoehe - oben - UNTEN) }}
          className="absolute inset-x-2 top-full mt-2 animate-fade-in overflow-y-auto overscroll-contain rounded-3xl border border-ak-rand bg-ak-flaeche shadow-[0_24px_60px_rgba(0,0,0,.45)] focus:outline-none"
        >
          {children}
        </div>,
        slot,
      )}
    </>
  )
}
