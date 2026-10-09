import { forwardRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '../../lib/i18n.tsx'
import { FilterZeichen } from '../kalender/Zeichen.tsx'
import { useWerkzeugSlot } from './werkzeug-slot.tsx'

/** Die Leiste (48 px) unter der Kopfzeile, per Portal im Slot der Kopfleiste. Rollt mit ihr ein und aus. */
export function Werkzeugleiste({ children }: { children: ReactNode }) {
  const { t } = useLang()
  const { element } = useWerkzeugSlot()
  if (!element) return null
  return createPortal(
    <div role="toolbar" aria-label={t('filter.button')} className="flex h-12 items-center gap-2 border-t border-ak-linie px-2">
      {children}
    </div>,
    element,
  )
}

/** Die Filter-Pille: Zähler der aktiven Filter, `aria-expanded`, steuert das Filterfenster. */
export const FilterPille = forwardRef<HTMLButtonElement, { offen: boolean; anzahl: number; onClick: () => void }>(function FilterPille({ offen, anzahl, onClick }, ref) {
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
        'flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-bold transition',
        offen || anzahl ? 'border-ak-akzent bg-ak-akzent text-ak-auf-akzent' : 'border-ak-rand bg-ak-flaeche text-ak-text',
      ].join(' ')}
    >
      <FilterZeichen />
      {t('filter.button')}
      {anzahl > 0 && <span className="rounded-full bg-[#0d0f14] px-1.5 text-[11px] text-[#f2f1ee]">{anzahl}</span>}
    </button>
  )
})

/** Rollbare Reihe für alles neben der Pille; die Pille und feste Teile stehen außerhalb. */
export function RollReihe({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">{children}</div>
}
