import type { ReactNode } from 'react'
import type { Herkunft } from '../../lib/herkunft.ts'

/** Flaggen als kleine SVG-Zeichnungen (Mockup „Herkunftsfilter" B); „USA & Co." trägt die US-Flagge, „Unbekannt" ein graues Fragezeichen. */
const ZEICHNUNG: Record<Herkunft, ReactNode> = {
  JP: (
    <>
      <rect width="20" height="14" fill="#fff" />
      <circle cx="10" cy="7" r="3.6" fill="#bc002d" />
    </>
  ),
  KR: (
    <>
      <rect width="20" height="14" fill="#fff" />
      <path d="M6.5 7a3.5 3.5 0 0 1 7 0Z" fill="#cd2e3a" />
      <path d="M6.5 7a3.5 3.5 0 0 0 7 0Z" fill="#0047a0" />
      <path d="M2 2h3M2 12h3M15 2h3M15 12h3" stroke="#111" strokeWidth="1.2" />
    </>
  ),
  CN: (
    <>
      <rect width="20" height="14" fill="#de2910" />
      <path d="m5 2.2.9 2.6h2.7l-2.2 1.6.9 2.6L5 7.4 2.8 9l.9-2.6L1.5 4.8h2.7Z" fill="#ffde00" />
    </>
  ),
  TW: (
    <>
      <rect width="20" height="14" fill="#fe0000" />
      <rect width="10" height="7" fill="#000095" />
      <circle cx="5" cy="3.5" r="2" fill="#fff" />
    </>
  ),
  US: (
    <>
      <rect width="20" height="14" fill="#fff" />
      <path d="M0 1h20M0 3.8h20M0 6.6h20M0 9.4h20M0 12.2h20" stroke="#b22234" strokeWidth="1.4" />
      <rect width="9" height="7.6" fill="#3c3b6e" />
    </>
  ),
  XX: (
    <>
      <rect width="20" height="14" fill="#8b8f99" />
      <text x="10" y="11" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily="sans-serif">?</text>
    </>
  ),
}

export function Flagge({ land }: { land: Herkunft }) {
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true" className="shrink-0 rounded-[2px] ring-1 ring-black/15">
      {ZEICHNUNG[land]}
    </svg>
  )
}
