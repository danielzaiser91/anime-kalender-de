import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import type { ViewId } from '../lib/router.ts'
import { useLang, type TranslationKey } from '../lib/i18n.tsx'
import { KalenderZeichen, NewsZeichen, RasterZeichen, ZahnradZeichen } from './kalender/Zeichen.tsx'

/**
 * **Auf dem Handy steht die Navigation unten, in Daumenreichweite** — Kalender, Datenbank, News und
 * das Zahnrad (26.09.2026). Per Portal am `body`: Die Kopfleiste hat `backdrop-filter`, und darunter
 * bezöge sich `position: fixed` auf die Kopfleiste statt auf das Fenster.
 */
export function HandyNavigation({
  aktiv,
  onView,
  kalender,
  einstellungen,
}: {
  aktiv: 'kalender' | 'datenbank' | 'news' | undefined
  onView: (v: ViewId) => void
  /** Woche oder Monat — „Kalender" behält die gewählte Ansicht. */
  kalender: ViewId
  einstellungen: () => void
}) {
  const { t } = useLang()
  const eintrag = (an: boolean, label: string, zeichen: ReactNode, onClick: () => void, key: string) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      aria-current={an ? 'page' : undefined}
      className={[
        'flex h-[52px] min-w-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-2xl text-xs transition',
        an ? 'bg-ak-akzent font-extrabold text-ak-auf-akzent' : 'font-semibold text-ak-leise hover:text-ak-text',
      ].join(' ')}
    >
      {zeichen}
      <span className="max-w-full truncate">{label}</span>
    </button>
  )
  return createPortal(
    <nav
      aria-label={t('nav.bereich')}
      className="fixed inset-x-3 bottom-[calc(12px+env(safe-area-inset-bottom))] z-30 grid grid-cols-4 rounded-[22px] border border-ak-rand bg-ak-flaeche/95 p-1.5 backdrop-blur md:hidden"
    >
      {eintrag(aktiv === 'kalender', t('nav.kalender'), <KalenderZeichen />, () => onView(kalender), 'kalender')}
      {eintrag(aktiv === 'datenbank', t('view.datenbank' as TranslationKey), <RasterZeichen />, () => onView('datenbank'), 'datenbank')}
      {eintrag(aktiv === 'news', t('view.news'), <NewsZeichen />, () => onView('news'), 'news')}
      {eintrag(false, t('einstellungen.titel'), <ZahnradZeichen />, einstellungen, 'einstellungen')}
    </nav>,
    document.body,
  )
}
