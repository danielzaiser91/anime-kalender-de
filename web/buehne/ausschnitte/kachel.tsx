import { useState } from 'react'
import { DatabaseView } from '../../src/components/DatabaseView.tsx'
import { EMPTY_FILTERS } from '../../src/lib/filters.ts'
import type { DbSort } from '../../src/lib/router.ts'
import { useDatensatz, useTitelListen } from './datensatz.ts'

const LEER = new Set<number>()
const nichts = () => {}

/** Ausschnitt `kachel`: das echte Kachelraster der Datenbank (samt Kopfzeile) über alle Titel des Bestands, auch die ohne Synchro. */
export function Kachel() {
  const data = useDatensatz()
  const listen = useTitelListen(data)
  const [grouped, setGrouped] = useState(true)
  const [ohneSynchro, setOhneSynchro] = useState(true)
  const [sort, setSort] = useState<DbSort>()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  if (!data || !listen) return null
  return (
    <div style={{ padding: 16 }}>
      <DatabaseView
        data={data}
        titles={ohneSynchro ? [...listen.mit, ...listen.ohne] : listen.mit}
        grouped={grouped}
        onGroupedChange={setGrouped}
        ohneSynchro={ohneSynchro}
        onOhneSynchroChange={setOhneSynchro}
        ohneSynchroLaedt={false}
        favorites={LEER}
        hidden={LEER}
        onToggleFavorite={nichts}
        onToggleHidden={nichts}
        onOpenTitle={nichts}
        suche=""
        gewaehlt={sort}
        onSortChange={setSort}
        filters={filters}
        onFiltersChange={setFilters}
      />
    </div>
  )
}
