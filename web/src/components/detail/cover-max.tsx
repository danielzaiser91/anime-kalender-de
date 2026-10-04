import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Tooltip } from '../ui.tsx'

/**
 * **Das Cover groß ansehen** (Daniel, 04.10.2026): Ein Symbol in der Bedienleiste des Panels öffnet das Cover
 * maximiert. Die Ansicht liegt als eigene Schicht über allem (`createPortal`), damit darunter nichts ausgelöst wird;
 * ein Klick irgendwo in der Schicht oder Escape schließt sie. Sie hat keine Adresse — der Zustand lebt nur hier.
 */
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
  if (!bild) return null
  return (
    <>
      <Tooltip text="Cover maximiert anzeigen" seite="unten">
        <button
          type="button"
          aria-label="Cover maximiert anzeigen"
          onClick={() => setOffen(true)}
          className="inline-flex size-7 cursor-pointer items-center justify-center rounded-full text-base text-slate-300 transition hover:text-white"
        >
          ⤢
        </button>
      </Tooltip>
      {offen &&
        createPortal(
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
        )}
    </>
  )
}
