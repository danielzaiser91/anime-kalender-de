import { useState } from 'react'
import { FilterBar } from '../../src/components/FilterBar.tsx'
import { EMPTY_FILTERS, type FilterState } from '../../src/lib/filters.ts'
import { useDatensatz } from './datensatz.ts'

/** Zwei gewählte Genres, damit die Chips zu sehen sind. */
const BEISPIEL: FilterState = { ...EMPTY_FILTERS, genres: ['Action', 'Fantasy'] }

/** Ausschnitt `filter`: die echte Filterleiste der Datenbank mit geöffnetem Filterfenster und zwei Chips. */
export function Filter() {
  const data = useDatensatz()
  const [filters, setFilters] = useState(BEISPIEL)
  const [offen, setOffen] = useState(true)
  if (!data) return null
  return (
    <div style={{ padding: 8 }}>
      <FilterBar meta={data.meta} filters={filters} onChange={setFilters} showConfidence favoriteCount={0} open={offen} setOpen={setOffen} />
    </div>
  )
}
