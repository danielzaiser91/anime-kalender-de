/**
 * Flaggen als SVG statt als Emoji.
 *
 * Grund: Windows liefert keine Bilder für die Regional-Indicator-Zeichen — aus
 * 🇩🇪 werden dort schlicht die Buchstaben „DE". Chrome und Edge unter Windows
 * zeigen deshalb Buchstabenpaare, wo auf macOS und Android eine Flagge steht.
 * Gezeichnete Flaggen sehen überall gleich aus.
 */
import type { Lang } from '../lib/i18n.tsx'

const RADIUS = 3

export function FlagDE({ size = 20 }: { size?: number }) {
  const h = Math.round(size * 0.7)
  return (
    <svg width={size} height={h} viewBox="0 0 20 14" role="img" aria-label="Deutschland">
      <defs>
        <clipPath id="flag-de-clip">
          <rect width="20" height="14" rx={RADIUS} />
        </clipPath>
      </defs>
      <g clipPath="url(#flag-de-clip)">
        <rect width="20" height="14" fill="#000" />
        <rect y="4.667" width="20" height="4.667" fill="#dd0000" />
        <rect y="9.333" width="20" height="4.667" fill="#ffce00" />
      </g>
      <rect width="20" height="14" rx={RADIUS} fill="none" stroke="rgba(0,0,0,.35)" />
    </svg>
  )
}

export function FlagGB({ size = 20 }: { size?: number }) {
  const h = Math.round(size * 0.7)
  return (
    <svg width={size} height={h} viewBox="0 0 20 14" role="img" aria-label="United Kingdom">
      <defs>
        <clipPath id="flag-gb-clip">
          <rect width="20" height="14" rx={RADIUS} />
        </clipPath>
      </defs>
      <g clipPath="url(#flag-gb-clip)">
        <rect width="20" height="14" fill="#012169" />
        {/* Diagonale Kreuze: erst weiß breit, dann rot schmal darüber */}
        <path d="M0 0 L20 14 M20 0 L0 14" stroke="#fff" strokeWidth="3" />
        <path d="M0 0 L20 14 M20 0 L0 14" stroke="#c8102e" strokeWidth="1.4" />
        {/* Gerades Kreuz */}
        <path d="M10 0 v14 M0 7 h20" stroke="#fff" strokeWidth="4.6" />
        <path d="M10 0 v14 M0 7 h20" stroke="#c8102e" strokeWidth="2.6" />
      </g>
      <rect width="20" height="14" rx={RADIUS} fill="none" stroke="rgba(0,0,0,.35)" />
    </svg>
  )
}

export function Flag({ lang, size }: { lang: Lang; size?: number }) {
  return lang === 'de' ? <FlagDE size={size} /> : <FlagGB size={size} />
}
