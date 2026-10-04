import { useState } from 'react'
import type { DataMeta } from '@shared/types.ts'
import { activeFilterCount, type FilterState } from '../lib/filters.ts'
import { useLang } from '../lib/i18n.tsx'
import { FilterDetailsFeld } from './FilterDetails.tsx'
import { AktiveFilter } from './kalender/AktiveFilter.tsx'

/**
 * Die Filterleiste der Datenbank.
 *
 * **Dieselbe Ansicht wie im Kalender**: Der Zustandsstreifen
 * steht sichtbar über dem Knopf, und das Feld öffnet genau die Filter, die auch
 * Woche und Monat zeigen — Klick-Modus in eigener Zeile, betroffene Filter im
 * Kasten, der Rest hinter „mehr Filter". Gesucht wird seit dem 26.09.2026 im
 * Kopf der Seite.
 */
export type FilterBarProps = {
  meta: DataMeta
  filters: FilterState
  onChange: (next: FilterState) => void
  showConfidence: boolean
  favoriteCount: number
}

/**
 * **Derselbe Kasten, unten angedockt**. Vorher stand die Leiste oben im Fluss der Titelliste und
 * war beim Scrollen
 * weg. Platz für die letzten Kacheln lässt die Fußzeile (kein Leerraum oben, 04.10.2026).
 */
export function FilterBarDock(props: FilterBarProps) {
  return (
    <>
      <div className="fixed inset-x-2 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 mx-auto md:bottom-[calc(1rem+env(safe-area-inset-bottom))] max-w-[1180px]">
        <FilterBar {...props} />
      </div>
    </>
  )
}

export function FilterBar({
  meta,
  filters,
  onChange,
  showConfidence,
  favoriteCount,
}: FilterBarProps) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const count = activeFilterCount(filters)

  return (
    <div className="rounded-2xl border border-ak-rand bg-ak-flaeche">
      {/* Die Leiste bleibt an ihrer Stelle, der Inhalt klappt darüber auf (Daniel, 04.10.2026). */}
      {open && (
        <div className="max-h-[calc(100dvh-15rem)] animate-fade-in overflow-y-auto overscroll-contain border-b border-ak-linie">
          <FilterDetailsFeld
            meta={meta}
            filters={filters}
            onChange={onChange}
            showConfidence={showConfidence}
            favoriteCount={favoriteCount}
          />
        </div>
      )}
      {/* Auswahl links, Filter-Knopf rechts auf derselben Zeile. */}
      <div className="flex flex-wrap items-center gap-2 p-2">
        <div className="min-w-0 flex-1">
          <AktiveFilter filters={filters} onChange={onChange} />
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="ml-auto inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border border-ak-rand px-3 py-1.5 text-sm font-semibold text-ak-text transition hover:bg-ak-flaeche-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ak-akzent"
        >
          {t('filter.button')}
          {count > 0 && <span className="rounded-full bg-ak-akzent px-1.5 text-[11px] font-bold text-ak-auf-akzent">{count}</span>}
          <span aria-hidden="true" className={open ? 'rotate-180 transition' : 'transition'}>
            ▾
          </span>
        </button>
      </div>

    </div>
  )
}
