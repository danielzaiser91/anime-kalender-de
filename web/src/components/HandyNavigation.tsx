import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import type { ViewId } from '../lib/router.ts'
import { useLang, type TranslationKey } from '../lib/i18n.tsx'
import { KalenderZeichen, NewsZeichen, RasterZeichen, ZahnradZeichen } from './kalender/Zeichen.tsx'
import { SaisonZeichen } from './saison-zeichen.tsx'
import { useVorschau } from '../lib/vorschau.ts'
import { useNavVersteckt } from '../lib/nav-scroll.ts'

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
  aktiv: 'kalender' | 'datenbank' | 'news' | 'saison' | undefined
  onView: (v: ViewId) => void
  /** Woche oder Monat — „Kalender" behält die gewählte Ansicht. */
  kalender: ViewId
  einstellungen: () => void
}) {
  const { t } = useLang()
  const eintrag = (an: boolean, label: string, zeichen: ReactNode, onClick: () => void, key: string, voll?: string) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      aria-current={an ? 'page' : undefined}
      aria-label={voll}
      className={[
        'flex h-[52px] min-w-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-2xl text-xs transition',
        an ? 'bg-ak-akzent font-extrabold text-ak-auf-akzent' : 'font-semibold text-ak-leise hover:text-ak-text',
      ].join(' ')}
    >
      {zeichen}
      <span className="max-w-full truncate">{label}</span>
    </button>
  )
  const ausblenden = useVorschau('leisten') === 'ausblenden'
  const { versteckt, zeigen } = useNavVersteckt(ausblenden)
  return createPortal(
    <nav
      aria-label={t('nav.bereich')}
      onFocus={zeigen}
      className={[
        'fixed inset-x-3 bottom-[calc(12px+env(safe-area-inset-bottom))] z-30 grid grid-cols-5 rounded-[22px] border border-ak-rand bg-ak-flaeche/95 p-1.5 backdrop-blur md:hidden',
        /* Nur mit Vorschau „leisten": sanft nach unten aus dem Bild; ein Tastenfokus holt sie zurück (`onFocus`). */
        ausblenden && 'transition-transform duration-200',
        versteckt && 'translate-y-[calc(100%+24px+env(safe-area-inset-bottom))]',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {eintrag(aktiv === 'kalender', t('nav.kalender'), <KalenderZeichen />, () => onView(kalender), 'kalender')}
      {eintrag(aktiv === 'datenbank', t('view.datenbank' as TranslationKey), <RasterZeichen />, () => onView('datenbank'), 'datenbank')}
      {eintrag(aktiv === 'news', t('view.news'), <NewsZeichen />, () => onView('news'), 'news')}
      {eintrag(aktiv === 'saison', t('view.saison' as TranslationKey), <SaisonZeichen />, () => onView('saison'), 'saison')}
      {eintrag(false, t('nav.einstellungenKurz' as TranslationKey), <ZahnradZeichen />, einstellungen, 'einstellungen', t('einstellungen.titel'))}
    </nav>,
    document.body,
  )
}
