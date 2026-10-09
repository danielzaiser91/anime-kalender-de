import { useEffect, useState } from 'react'
import type { ReleaseEvent } from '@shared/types.ts'
import type { Dataset } from '../../lib/data.ts'
import type { ViewId } from '../../lib/router.ts'
import { activeFilterCount, type FilterState } from '../../lib/filters.ts'
import { Steuerleiste } from './KalenderKopf.tsx'
import { FilterFeld } from './FilterFeld.tsx'

export interface KalenderFilterProps {
  data: Dataset
  view: ViewId
  date: string
  filters: FilterState
  setFilters: (filters: FilterState) => void
  tvAn: boolean
  setTvAn: (an: boolean) => void
  favoriteCount: number
  termine: { alle: string[]; sichtbar: string[] }
  /** Alle Termine des gezeigten Zeitraums, ungefiltert. */
  zeitraum: ReleaseEvent[]
  /** Treffer im Zeitraum nach den Filtern. */
  treffer: number
  zeitraumWort: string
  onDate: (date: string) => void
  onWoche: () => void
  onMonat: () => void
}

/** Steuerleiste (Blättern, Woche/Monat, Filterknopf) und das Filterfeld darüber. */
export function KalenderFilter(p: KalenderFilterProps) {
  const [filterOffen, setFilterOffen] = useState(false)
  useEscapeSchliesst(filterOffen, () => setFilterOffen(false))
  return (
    <>
      <Steuerleiste
        view={p.view}
        date={p.date}
        filterOffen={filterOffen}
        filterAnzahl={activeFilterCount(p.filters) + (p.tvAn ? 0 : 1)}
        termine={p.termine}
        onFilter={() => setFilterOffen(!filterOffen)}
        onDate={p.onDate}
        onWoche={p.onWoche}
        onMonat={p.onMonat}
      />
      {filterOffen && (
        /* Das Filterfeld steht über der Steuerleiste — dort, wo man es geöffnet hat. Die gewählten
           Filter stehen **im** Feld (`FilterFeld`), nicht mehr als eigene Zeile darüber. */
        <div className="fixed inset-x-2 bottom-[calc(9.5rem+env(safe-area-inset-bottom))] z-30 mx-auto max-h-[calc(100dvh-15.75rem)] max-w-[1180px] overflow-y-auto rounded-3xl shadow-[0_24px_60px_rgba(0,0,0,.45)] md:bottom-[4.5rem] md:max-h-[calc(100dvh-10rem)]">
          <FilterFeld
            data={p.data}
            filters={p.filters}
            onChange={p.setFilters}
            tvAn={p.tvAn}
            setTvAn={p.setTvAn}
            favoriteCount={p.favoriteCount}
            zeitraum={p.zeitraum}
            treffer={p.treffer}
            zeitraumWort={p.zeitraumWort}
            schliessen={() => setFilterOffen(false)}
          />
        </div>
      )}
    </>
  )
}

/** Escape schließt das Filterfeld, solange es offen ist. */
function useEscapeSchliesst(offen: boolean, schliessen: () => void) {
  useEffect(() => {
    if (!offen) return
    const taste = (e: KeyboardEvent) => e.key === 'Escape' && schliessen()
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [offen, schliessen])
}
