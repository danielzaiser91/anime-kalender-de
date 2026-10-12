import { useState, type ReactNode } from 'react'

/** Die leise Überschrift mit „›": der zweite Überschriften-Stil neben der Karte (Daniel, 09.10.2026: zwei Stile statt drei). */
export function AufklappKopf({ offen, onClick, children }: { offen: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={offen}
      className="flex min-h-11 w-full cursor-pointer items-center gap-1.5 text-left text-t5 font-bold uppercase tracking-[.08em] text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-100"
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
