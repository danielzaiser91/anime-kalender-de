import type { ReactNode } from 'react'
import type { ViewId } from '../lib/router.ts'
import type { Bereich } from '../lib/bereiche.ts'
import { useLang, type TranslationKey } from '../lib/i18n.tsx'
import { KalenderZeichen, NewsZeichen, RasterZeichen, ZahnradZeichen } from './kalender/Zeichen.tsx'
import { SaisonZeichen } from './saison-zeichen.tsx'

/**
 * **Auf dem Handy steht die Navigation oben in der Kopfleiste** — Kalender, Datenbank, News, Saison und
 * das Zahnrad. Unten, in Daumenreichweite, sitzt seit 12.10.2026 die Werkzeugleiste der Ansicht
 * (`filter/Werkzeugleiste.tsx`); die Navigation rollt mit der Kopfleiste beim Abwärtsscrollen ein.
 */
export function HandyNavigation({
  aktiv,
  onView,
  kalender,
  einstellungen,
}: {
  aktiv: Bereich | undefined
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
        'flex h-12 min-w-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-2xl text-xs transition',
        an ? 'bg-ak-gewaehlt font-bold text-ak-auf-gewaehlt' : 'font-semibold text-ak-leise hover:text-ak-text',
      ].join(' ')}
    >
      {zeichen}
      <span className="max-w-full truncate max-[339px]:text-[11px] max-[339px]:tracking-tight">{label}</span>
    </button>
  )
  return (
    <nav
      aria-label={t('nav.bereich')}
      className="grid grid-cols-5 border-t border-ak-linie pl-[max(0.375rem,env(safe-area-inset-left))] pr-[max(0.375rem,env(safe-area-inset-right))] py-1 md:hidden"
    >
      {eintrag(aktiv === 'kalender', t('nav.kalender'), <KalenderZeichen />, () => onView(kalender), 'kalender')}
      {eintrag(aktiv === 'datenbank', t('view.datenbank' as TranslationKey), <RasterZeichen />, () => onView('datenbank'), 'datenbank')}
      {eintrag(aktiv === 'news', t('view.news'), <NewsZeichen />, () => onView('news'), 'news')}
      {eintrag(aktiv === 'saison', t('view.saison' as TranslationKey), <SaisonZeichen />, () => onView('saison'), 'saison')}
      {eintrag(false, t('nav.einstellungenKurz' as TranslationKey), <ZahnradZeichen />, einstellungen, 'einstellungen', t('einstellungen.titel'))}
    </nav>
  )
}
