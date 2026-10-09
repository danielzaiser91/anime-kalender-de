import { lazy, Suspense, useRef, useState } from 'react'
import { PT } from '../lib/patchnotes-texte.ts'
import { ladePatchnotes, leseGesehen, merkeGesehen } from '../lib/patchnotes.ts'

const PatchnotesDialog = lazy(() => import('./PatchnotesDialog.tsx'))

/**
 * Knopf „Neu auf der Webseite“ im News-Bereich. Dialog-Code und Liste (`patchnotes.json`) werden erst beim Klick geladen;
 * den Ungelesen-Punkt liefert `meta.patchnotesStand`, das ohnehin im Start steht.
 */
export function PatchnotesKnopf({ stand }: { stand?: string }) {
  const [offen, setOffen] = useState(false)
  const [gesehen, setGesehen] = useState(leseGesehen)
  const laden = useRef<ReturnType<typeof ladePatchnotes>>(undefined)
  const knopf = useRef<HTMLButtonElement>(null)
  if (!stand) return null
  const neu = gesehen !== stand

  const oeffne = () => {
    laden.current = ladePatchnotes()
    setOffen(true)
    merkeGesehen(stand)
    setGesehen(stand)
  }
  const beiZu = () => {
    setOffen(false)
    knopf.current?.focus()
  }

  return (
    <>
      <button
        ref={knopf}
        type="button"
        onClick={oeffne}
        aria-haspopup="dialog"
        className="ak-tz mb-3 inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-ak-rand bg-ak-flaeche px-4 text-xs font-bold text-ak-text transition hover:bg-ak-flaeche-2"
      >
        {PT.knopf}
        {neu && (
          <>
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-ak-akzent" />
            <span className="sr-only">{PT.neu}</span>
          </>
        )}
      </button>
      {offen && laden.current && (
        <Suspense fallback={null}>
          <PatchnotesDialog laden={laden.current} beiZu={beiZu} />
        </Suspense>
      )}
    </>
  )
}
