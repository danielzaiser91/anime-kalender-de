import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useEscape } from '../../lib/escape.ts'
import { useVisualViewportHoehe } from '../../lib/use-visual-viewport.ts'
import { useSeiteGesperrt } from '../../lib/use-seite-gesperrt.ts'
import { useVerlaufEintrag } from '../../lib/use-verlauf-eintrag.ts'

/** Luft über dem Fenster: ein Streifen der Kopfleiste bleibt sichtbar. */
const OBEN = 72

/**
 * Macht alles außer Leiste und Fenster `inert`: Tab, Klick und Vorlesen erreichen den Hintergrund nicht, solange das
 * Fenster offen ist. Gibt die Rücknahme zurück (nur, was hier gesperrt wurde).
 */
function hintergrundSperren(leiste: Element | null): () => void {
  const ziele = Array.from(document.body.children).filter((e) => !e.contains(leiste) && !e.hasAttribute('data-schleier') && e.tagName !== 'SCRIPT')
  const gesperrt = ziele.filter((e): e is HTMLElement => e instanceof HTMLElement && !e.inert)
  gesperrt.forEach((e) => (e.inert = true))
  return () => gesperrt.forEach((e) => (e.inert = false))
}

/**
 * Das Filterfenster der Werkzeugleiste: sitzt bündig über der Leiste am unteren Rand (volle Breite), hält Kopf und Fuß fest, der Mittelteil scrollt; es nimmt höchstens
 * den sichtbaren Bereich darüber (mit Tastatur kürzer). Kein Modal: dahinter liegt nur ein Schleier zum Wegtippen.
 * Escape und Zurück schließen; der Fokus geht hinein und beim Schließen zurück an den Auslöser.
 */
export function FilterPopover({ offen, schliessen, ausloeser, label, children }: {
  offen: boolean
  schliessen: () => void
  ausloeser: RefObject<HTMLElement | null>
  label: string
  children: ReactNode
}) {
  const dialog = useRef<HTMLDivElement>(null)
  const zu = useRef(schliessen)
  zu.current = schliessen
  const hoehe = useVisualViewportHoehe(offen)
  useVerlaufEintrag(offen, schliessen)
  useSeiteGesperrt(offen)
  /* Das Fenster hängt in der Leiste des Auslösers (Portal am `body`), so liegt es ohne Messen genau darüber. */
  const leiste = ausloeser.current?.closest<HTMLElement>('[role=toolbar]') ?? null
  useEffect(() => {
    if (!offen) return
    const wieder = hintergrundSperren(leiste)
    /* Der Scrollbereich nimmt den Fokus, damit Pfeil- und Bild-Tasten ihn scrollen (das Fenster selbst scrollt nicht). */
    const ziel = dialog.current?.querySelector<HTMLElement>('[data-filter-scroll]') ?? dialog.current
    ziel?.focus()
    const knopf = ausloeser.current
    return () => {
      wieder()
      knopf?.focus()
    }
  }, [offen, leiste, ausloeser])
  useEscape(offen, () => zu.current())
  if (!offen || !leiste) return null
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
          style={{ maxHeight: Math.max(160, hoehe - leiste.offsetHeight - OBEN) }}
          className="absolute inset-x-0 bottom-full flex flex-col animate-fade-in overflow-hidden rounded-t-3xl border-t border-ak-rand bg-ak-flaeche shadow-[0_-24px_60px_rgba(0,0,0,.45)]"
        >
          {children}
        </div>,
        leiste,
      )}
    </>
  )
}
