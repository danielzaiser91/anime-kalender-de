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
export const SuchZeichen = ({ groesse }: Z) => (
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

/** Das Kalender-Symbol aus dem Favicon (`public/icons/icon.svg`) — das Wiedererkennungszeichen im Kopf. */
export function LogoZeichen({ groesse = 32 }: Z) {
  return (
    <svg viewBox="0 0 512 512" width={groesse} height={groesse} aria-hidden="true" className="shrink-0">
      <rect width="512" height="512" rx="102" fill="#1b2130" />
      <rect x="41" y="101" width="430" height="370" rx="95" fill="#e6e9f0" />
      <rect x="41" y="101" width="430" height="96" rx="95" fill="#38bdf8" />
      <rect x="41" y="168" width="430" height="37" fill="#38bdf8" />
      <rect x="144" y="67" width="34" height="69" rx="17" fill="#e6e9f0" />
      <rect x="333" y="67" width="34" height="69" rx="17" fill="#e6e9f0" />
      <path d="M213 268 351 342 213 416Z" fill="#0f1420" />
    </svg>
  )
}
