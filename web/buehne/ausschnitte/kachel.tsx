import { useState } from 'react'
import { DatabaseView } from '../../src/components/DatabaseView.tsx'
import { DetailPanel } from '../../src/components/DetailPanel.tsx'
import { EMPTY_FILTERS } from '../../src/lib/filters.ts'
import type { DbSort } from '../../src/lib/router.ts'
import { ErsatzKontext } from '../ersatz.tsx'
import { useDatensatz, useTitelListen } from './datensatz.ts'
import type { AusschnittEigenschaften } from './typ.ts'

const LEER = new Set<number>()
const nichts = () => {}

/** Ausschnitt `kachel`: das echte Kachelraster der Datenbank (samt Kopfzeile) über alle Titel des Bestands, auch die ohne Synchro; ein Klick öffnet das echte Detail-Panel (Escape und Kreuz schließen es). */
export function Kachel({ ersatz }: AusschnittEigenschaften) {
  const data = useDatensatz()
  const listen = useTitelListen(data)
  const [grouped, setGrouped] = useState(true)
  const [ohneSynchro, setOhneSynchro] = useState(true)
  const [sort, setSort] = useState<DbSort>()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [offen, setOffen] = useState<number>()
  if (!data || !listen) return null
  return (
    <ErsatzKontext.Provider value={ersatz}>
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
          onOpenTitle={setOffen}
          suche=""
          gewaehlt={sort}
          onSortChange={setSort}
          filters={filters}
          onFiltersChange={setFilters}
          onHinweisLoesen={nichts}
        />
      </div>
      {offen !== undefined && (
        <DetailPanel
          data={data}
          titleId={offen}
          favorites={LEER}
          hidden={LEER}
          onToggleFavorite={nichts}
          onToggleHidden={nichts}
          onClose={() => setOffen(undefined)}
          onOpenTitle={setOffen}
          onFilterBy={nichts}
        />
      )}
    </ErsatzKontext.Provider>
  )
}
