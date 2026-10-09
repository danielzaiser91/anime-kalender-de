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

/** Der runde Filter-Knopf: Zähler der aktiven Filter als Badge, `aria-expanded`, steuert das Filterfenster. */
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
        'relative flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border transition',
        offen || anzahl ? 'border-ak-akzent bg-ak-akzent text-ak-auf-akzent' : 'border-ak-rand bg-ak-flaeche text-ak-text',
      ].join(' ')}
    >
      <FilterZeichen />
      {anzahl > 0 && (
        <span aria-hidden className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-[#0d0f14] px-1 text-center text-[10px] leading-4 font-bold text-[#f2f1ee]">
          {anzahl}
        </span>
      )}
    </button>
  )
})
