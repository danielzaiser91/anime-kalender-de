import { useState } from 'react'
import type { DataMeta } from '@shared/types.ts'
import { EMPTY_FILTERS, activeFilterCount, type FilterState } from '../lib/filters.ts'
import { useLang } from '../lib/i18n.tsx'
import { Chip } from './ui.tsx'
import { FilterDetailsFeld } from './FilterDetails.tsx'

/**
 * Die Filterleiste der Datenbank. Gesucht wird seit dem 26.09.2026 im Kopf der Seite — ein zweites
 * Suchfeld hier stünde doppelt auf demselben Bildschirm.
 */
export function FilterBar({
  meta,
  filters,
  onChange,
  showConfidence,
  favoriteCount,
}: {
  meta: DataMeta
  filters: FilterState
  onChange: (next: FilterState) => void
  showConfidence: boolean
  favoriteCount: number
}) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const count = activeFilterCount(filters)
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch })

  return (
    <div className="rounded-2xl border border-ak-rand bg-ak-flaeche">
      <div className="flex flex-wrap items-center gap-2 p-2">
        <Chip active={filters.favoritesOnly} onClick={() => set({ favoritesOnly: !filters.favoritesOnly })} color="#fbbf24">
          ★ {t('filter.favourites')}
          {favoriteCount > 0 && <span className="opacity-60">({favoriteCount})</span>}
        </Chip>

        <Chip
          active={filters.kostenlosOnly}
          onClick={() => set({ kostenlosOnly: !filters.kostenlosOnly })}
          color="#10b981"
          title={t('filter.kostenlosHint')}
        >
          {t('filter.kostenlos')}
        </Chip>

        {/* Nur in der Datenbank sinnvoll: Im Kalender hat ohnehin alles einen Termin. */}
        {showConfidence && (
          <Chip
            active={filters.availableOnly}
            onClick={() => set({ availableOnly: !filters.availableOnly })}
            color="#34d399"
            title={t('filter.availableHint')}
          >
            ▶ {t('filter.available')}
          </Chip>
        )}

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-ak-rand px-3 py-1.5 text-sm font-semibold text-ak-text transition hover:bg-ak-flaeche-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ak-akzent"
        >
          {t('filter.button')}
          {count > 0 && <span className="rounded-full bg-ak-akzent px-1.5 text-[11px] font-bold text-ak-auf-akzent">{count}</span>}
          <span aria-hidden="true" className={open ? 'rotate-180 transition' : 'transition'}>
            ▾
          </span>
        </button>

        {count > 0 && (
          <button
            type="button"
            onClick={() => onChange({ ...EMPTY_FILTERS })}
            className="cursor-pointer rounded-lg px-2.5 py-2 text-sm text-ak-leise underline-offset-2 hover:underline"
          >
            {t('filter.reset')}
          </button>
        )}
      </div>

      {open && (
        <div className="animate-fade-in border-t border-ak-linie">
          <FilterDetailsFeld meta={meta} filters={filters} onChange={onChange} showConfidence={showConfidence} />
        </div>
      )}
    </div>
  )
}
