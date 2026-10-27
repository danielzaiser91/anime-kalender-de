import type { ReactNode } from 'react'

/** Strichzeichen der Poster-Gestaltung: 24er-Raster, `currentColor`, 2 px. */
function Strich({ children, groesse = 18 }: { children: ReactNode; groesse?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={groesse}
      height={groesse}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {children}
    </svg>
  )
}

type Z = { groesse?: number }

export const KalenderZeichen = ({ groesse }: Z) => (
  <Strich groesse={groesse}>
    <rect x="3.5" y="5" width="17" height="15" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Strich>
)
export const GlockenZeichen = ({ groesse }: Z) => (
  <Strich groesse={groesse}>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </Strich>
)
export const HerunterladenZeichen = ({ groesse }: Z) => (
  <Strich groesse={groesse}>
    <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
  </Strich>
)
export const PostZeichen = ({ groesse }: Z) => (
  <Strich groesse={groesse}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m4 7 8 6 8-6" />
  </Strich>
)
export const SonnenZeichen = ({ groesse }: Z) => (
  <Strich groesse={groesse}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </Strich>
)
export const MondZeichen = ({ groesse }: Z) => (
  <Strich groesse={groesse}>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
  </Strich>
)
export const ZahnradZeichen = ({ groesse }: Z) => (
  <Strich groesse={groesse}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </Strich>
)
export const SternZeichen = ({ groesse }: Z) => (
  <Strich groesse={groesse}>
    <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9Z" />
  </Strich>
)
export const BurgerZeichen = ({ groesse }: Z) => (
  <Strich groesse={groesse}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Strich>
)
export const SuchZeichen =({ groesse }: Z) => (
  <Strich groesse={groesse}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Strich>
)
export const FilterZeichen = ({ groesse }: Z) => (
  <Strich groesse={groesse}>
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="18" cy="18" r="2" />
  </Strich>
)
export const LinksZeichen = ({ groesse }: Z) => (
  <Strich groesse={groesse}>
    <path d="m15 6-6 6 6 6" />
  </Strich>
)
export const RechtsZeichen = ({ groesse }: Z) => (
  <Strich groesse={groesse}>
    <path d="m9 6 6 6-6 6" />
  </Strich>
)
export const FernsehZeichen = ({ groesse }: Z) => (
  <Strich groesse={groesse}>
    <rect x="3" y="5" width="18" height="12" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </Strich>
)
export const KlappeZeichen = ({ groesse }: Z) => (
  <Strich groesse={groesse}>
    <rect x="3" y="10" width="18" height="11" rx="2" />
    <path d="m3 10 2.4-5.2 4.3 1L7.3 11M10.6 5.9l4.3 1L12.5 11M15.8 7l4.3 1L17.7 11" />
  </Strich>
)
export const RasterZeichen = ({ groesse }: Z) => (
  <Strich groesse={groesse}>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </Strich>
)
export const NewsZeichen = ({ groesse }: Z) => (
  <Strich groesse={groesse}>
    <path d="M5 4h11a2 2 0 0 1 2 2v13a1 1 0 0 0 2 0V9" />
    <path d="M5 4a1 1 0 0 0-1 1v13a2 2 0 0 0 2 2h13" />
    <path d="M8 8h6M8 12h6M8 16h4" />
  </Strich>
)
export const KreuzZeichen = ({ groesse }: Z) => (
  <Strich groesse={groesse}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Strich>
)

/** Die Marke „Block AK" aus dem Favicon (`public/icons/icon.svg`, Zeichnung in `pipeline/lib/og-marke.ts`) — das Wiedererkennungszeichen im Kopf. */
export function LogoZeichen({ groesse = 32, className = '' }: Z & { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={groesse} height={groesse} aria-hidden="true" fill="#0d0f14" className={`shrink-0 ${className}`}>
      <rect width="64" height="64" rx="14" />
      <rect x="8" y="14" width="48" height="42" rx="8" fill="#ff5a36" />
      <rect x="8" y="24" width="48" height="4" />
      <rect x="18" y="8" width="4" height="12" rx="2" />
      <rect x="42" y="8" width="4" height="12" rx="2" />
      <path d="M10 52 L18.5 31 H23.5 L32 52 H27 L25 47 H17 L15 52 Z M21 37 L23.4 43 H18.6 Z" fillRule="evenodd" />
      <rect x="35" y="31" width="5" height="21" />
      <path d="M40 43 L50 31 M40 41 L50 52" fill="none" stroke="#0d0f14" strokeWidth="5" strokeLinecap="butt" />
    </svg>
  )
}
