import { createPortal } from 'react-dom'
import type React from 'react'
import { VIEWS, type ViewId } from '../lib/router.ts'
import { useLang, type TranslationKey } from '../lib/i18n.tsx'

/**
 * **Auf dem Handy steht die Navigation unten, in Daumenreichweite.** Oben lief die Reiterleiste
 * mit sieben Reitern über den Rand („Favoriten" abgeschnitten, „Wo?" und „News" nur durch
 * Wischen erreichbar) und kostete zusammen mit Titel- und Datumszeile ein Viertel des Schirms.
 *
 * Per Portal am `body`: Die Kopfleiste hat `backdrop-filter`, und darunter bezöge sich
 * `position: fixed` auf die Kopfleiste statt auf das Fenster (wie beim Kino-Dialog).
 */
export function HandyNavigation({ aktiv, onView }: { aktiv: ViewId; onView: (v: ViewId) => void }) {
  const { t } = useLang()
  return createPortal(
    <nav
      aria-label="Ansicht"
      className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-7 border-t border-slate-200 bg-[#f6f7fb]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden dark:border-white/10 dark:bg-[#0a0e17]/95"
    >
      {VIEWS.filter((v) => v.inNav).map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => onView(v.id)}
          aria-current={aktiv === v.id}
          className={[
            'flex min-w-0 cursor-pointer flex-col items-center gap-0.5 pt-2 pb-1.5 text-[10px] font-medium transition',
            aktiv === v.id
              ? 'text-sky-700 dark:text-sky-300'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
          ].join(' ')}
        >
          <span className={['rounded-full px-2.5 py-0.5', aktiv === v.id ? 'bg-sky-500/15' : ''].join(' ')}>
            {ZEICHEN[v.id]}
          </span>
          <span className="max-w-full truncate">{t((KURZ[v.id] ?? `view.${v.id}`) as TranslationKey)}</span>
        </button>
      ))}
    </nav>,
    document.body,
  )
}

/** Beschriftungen, die in ein Siebtel von 375 px nicht passen. */
const KURZ: Partial<Record<ViewId, TranslationKey>> = { wo: 'view.wo.short', datenbank: 'view.datenbank.short' }

/** Strichzeichen im Stil der übrigen Symbole: 24er-Raster, `currentColor`, 1,8 px. */
function Zeichen({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

const ZEICHEN: Partial<Record<ViewId, React.ReactNode>> = {
  woche: (
    <Zeichen>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4M9 14v3M15 14v3" />
    </Zeichen>
  ),
  monat: (
    <Zeichen>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4M7.5 14h.01M12 14h.01M16.5 14h.01M7.5 17.5h.01M12 17.5h.01" />
    </Zeichen>
  ),
  agenda: (
    <Zeichen>
      <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
    </Zeichen>
  ),
  datenbank: (
    <Zeichen>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </Zeichen>
  ),
  favoriten: (
    <Zeichen>
      <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
    </Zeichen>
  ),
  wo: (
    <Zeichen>
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </Zeichen>
  ),
  news: (
    <Zeichen>
      <path d="M5 4h11a2 2 0 0 1 2 2v13a1 1 0 0 0 2 0V9M5 4a1 1 0 0 0-1 1v13a2 2 0 0 0 2 2h13M8 8h6M8 12h6M8 16h4" />
    </Zeichen>
  ),
}
