import { useState, type ReactNode } from 'react'
import { TREFFER_24_HOCH } from './tippziel.ts'

/** Die leise Überschrift mit „›": der zweite Überschriften-Stil neben der Karte (Daniel, 09.10.2026: zwei Stile statt drei). */
export function AufklappKopf({ offen, onClick, children }: { offen: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={offen}
      className={`flex w-full cursor-pointer items-center gap-1.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 ${TREFFER_24_HOCH}`}
    >
      <span aria-hidden className={`transition-transform ${offen ? 'rotate-90' : ''}`}>
        ›
      </span>
      {children}
    </button>
  )
}

/** Ein Bereich mit leiser Überschrift, anfangs offen. */
export function Aufklappbar({ titel, children }: { titel: string; children: ReactNode }) {
  const [offen, setOffen] = useState(true)
  return (
    <div>
      <AufklappKopf offen={offen} onClick={() => setOffen((v) => !v)}>
        {titel}
      </AufklappKopf>
      {offen && <div className="mt-2">{children}</div>}
    </div>
  )
}
