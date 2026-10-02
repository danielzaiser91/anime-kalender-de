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
 * **Derselbe Kasten, unten angedockt** (Daniel, 02.10.2026: „auf reiter datenbank scrollt der
 * filter nicht mit. dort so implementieren wie auf kalender reiter. also nicht oben anheften,
 * sondern unten."). Vorher stand die Leiste oben im Fluss der Titelliste und war beim Scrollen
 * weg. Der Platzhalter darunter hält die letzten Kacheln frei.
 */
export function FilterBarDock(props: FilterBarProps) {
  return (
    <>
      <div className="fixed inset-x-2 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 mx-auto max-h-[calc(100dvh-3rem)] max-w-[1180px] overflow-y-auto">
        <FilterBar {...props} />
      </div>
      <div className="h-20" aria-hidden="true" />
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

      {open && (
        <div className="animate-fade-in border-t border-ak-linie">
          <FilterDetailsFeld
            meta={meta}
            filters={filters}
            onChange={onChange}
            showConfidence={showConfidence}
            favoriteCount={favoriteCount}
          />
        </div>
      )}
    </div>
  )
}
