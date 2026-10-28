import { forwardRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '../../lib/i18n.tsx'
import { filterFarbe } from '../kalender/KalenderKopf.tsx'
import { FilterZeichen } from '../kalender/Zeichen.tsx'

/**
 * Die Leiste (rund 61 px hoch, gemessen 28.10.2026) am unteren Rand, in Daumenreichweite — Filter, Ansicht, Blättern. Per Portal am `body`: Die Kopfleiste
 * rollt per `transform` ein, und darunter bezöge sich `position: fixed` auf die Kopfleiste statt auf das Fenster.
 */
export function Werkzeugleiste({ children }: { children: ReactNode }) {
  const { t } = useLang()
  return createPortal(
    <div
      role="toolbar"
      aria-label={t('filter.button')}
      className="fixed inset-x-0 bottom-0 z-30 box-content flex h-12 items-center gap-2 max-[359px]:gap-1 border-t border-ak-rand bg-ak-flaeche pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] md:hidden"
    >
      {children}
    </div>,
    document.body,
  )
}

/** Der runde Filter-Knopf mit dem Wort „Filter": Das Symbol allein ist nicht eindeutig. Zähler der aktiven Filter als Badge, `aria-expanded`, steuert das Filterfenster. */
export const FilterRund = forwardRef<HTMLButtonElement, { offen: boolean; anzahl: number; onClick: () => void }>(function FilterRund({ offen, anzahl, onClick }, ref) {
  const { t } = useLang()
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-expanded={offen}
      aria-controls="ak-filter"
      aria-haspopup="dialog"
      aria-label={anzahl ? `${t('filter.button')} (${anzahl})` : t('filter.button')}
      className={[
        'relative flex h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full border pr-3.5 pl-3 text-sm font-bold transition max-[339px]:gap-1 max-[339px]:px-2.5 max-[339px]:text-[13px]',
        filterFarbe(offen, anzahl),
      ].join(' ')}
    >
      <FilterZeichen />
      {t('filter.button')}
      {anzahl > 0 && (
        <span aria-hidden className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-[#0d0f14] px-1 text-center text-[10px] leading-4 font-bold text-[#f2f1ee]">
          {anzahl}
        </span>
      )}
    </button>
  )
})
