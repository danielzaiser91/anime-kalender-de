import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * **Das Cover groß ansehen** (Daniel, 04.10.2026; seit dem 06.10.2026 öffnet der Klick aufs Cover, das Symbol in der Leiste entfiel):
 * Die Ansicht liegt als eigene Schicht über allem (`createPortal`), damit darunter nichts ausgelöst wird; ein Klick irgendwo in der
 * Schicht oder Escape schließt sie. Sie hat keine Adresse — der Zustand lebt nur hier.
 */
export const COVER_MAX_EREIGNIS = 'cover-maximieren'
/** Klick auf das Cover: öffnet die Ansicht, außer ein Bedienelement im Bild wurde getroffen. */
export const beiCoverKlick = (e: { target: EventTarget }): void => {
  if (!(e.target as HTMLElement).closest('a,button,input,[role=button]')) window.dispatchEvent(new Event(COVER_MAX_EREIGNIS))
}
export function CoverMaximieren({ bild, titel }: { bild: string | undefined; titel: string }) {
  const [offen, setOffen] = useState(false)
  useEffect(() => {
    if (!offen) return
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      setOffen(false)
    }
    document.addEventListener('keydown', esc, true)
    return () => document.removeEventListener('keydown', esc, true)
  }, [offen])
  useEffect(() => {
    const auf = () => setOffen(true)
    window.addEventListener(COVER_MAX_EREIGNIS, auf)
    return () => window.removeEventListener(COVER_MAX_EREIGNIS, auf)
  }, [])
  if (!bild || !offen) return null
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Cover: ${titel}`}
      onClick={(e) => { e.stopPropagation(); setOffen(false) }}
      className="fixed inset-0 z-[80] flex cursor-zoom-out items-center justify-center bg-black/90 p-3"
    >
      <img src={bild} alt={titel} className="max-h-full max-w-full object-contain" />
    </div>,
    document.body,
  )
}
