import { useCallback, useRef, useState } from 'react'
import type { DataMeta, Title } from '@shared/types.ts'
import { activeFilterCount, EMPTY_FILTERS, type FilterState } from '../../lib/filters.ts'
import type { DbSort } from '../../lib/router.ts'
import { DbSortWahl, DbZaehlzeile } from '../db-bedienung.tsx'
import { DbKopfzeile, DbSchalter } from '../db-kopfzeile.tsx'
import { FilterDetailsFeld } from '../FilterDetails.tsx'
import { AktiveFilter } from '../kalender/AktiveFilter.tsx'
import { useMobil } from '../../lib/use-mobil.ts'
import { useLang } from '../../lib/i18n.tsx'
import { Abschnitte, FilterFuss, type FilterAbschnitt } from './filter-abschnitte.tsx'
import { FilterPopover } from './FilterPopover.tsx'
import { SchnellChips } from './SchnellChips.tsx'
import { SchnellInLeiste } from './schnell-in-leiste.ts'
import { FilterPille, RollReihe, Werkzeugleiste } from './Werkzeugleiste.tsx'

export interface DbKopfProps {
  meta: DataMeta
  filters: FilterState
  onFiltersChange: (next: FilterState) => void
  favoriteCount: number
  titles: Title[]
  ergebnisse: number
  gebuendelt: boolean
  suche: string
  sort: DbSort
  onSortChange: (next: DbSort) => void
  ohneSynchro: boolean
  onOhneSynchroChange: (next: boolean) => void
  laedt: boolean
  grouped: boolean
  onGroupedChange: (next: boolean) => void
}

/** Über dem Raster: am Rechner Schalter und Zählzeile, am Handy die Werkzeugleiste mit Filterfenster. */
export function DbKopfbereich(p: DbKopfProps) {
  const mobil = useMobil()
  if (mobil) return <DbWerkzeug {...p} />
  return (
    <>
      <DbSchalter ohneSynchro={p.ohneSynchro} onOhneSynchroChange={p.onOhneSynchroChange} laedt={p.laedt} grouped={p.grouped} onGroupedChange={p.onGroupedChange} />
      <DbZaehlzeile titles={p.titles} ergebnisse={p.ergebnisse} gebuendelt={p.gebuendelt} suche={p.suche} sort={p.sort} onSortChange={p.onSortChange} />
    </>
  )
}

function DbWerkzeug(p: DbKopfProps) {
  const { t } = useLang()
  const [offen, setOffen] = useState(false)
  const pille = useRef<HTMLButtonElement>(null)
  const zu = useCallback(() => setOffen(false), [])
  const anzahl = activeFilterCount(p.filters)
  const abschnitte: FilterAbschnitt[] = [
    { id: 'zaehlung', inhalt: <div className="text-sm text-ak-leise"><DbKopfzeile titles={p.titles} ergebnisse={p.ergebnisse} gebuendelt={p.gebuendelt} suche={p.suche} /></div> },
    { id: 'aktiv', inhalt: anzahl ? <AktiveFilter filters={p.filters} onChange={p.onFiltersChange} /> : null },
    { id: 'anzeige', inhalt: <DbSchalter ohneSynchro={p.ohneSynchro} onOhneSynchroChange={p.onOhneSynchroChange} laedt={p.laedt} grouped={p.grouped} onGroupedChange={p.onGroupedChange} /> },
  ]
  return (
    <SchnellInLeiste.Provider value>
      <Werkzeugleiste>
        <FilterPille ref={pille} offen={offen} anzahl={anzahl} onClick={() => setOffen(!offen)} />
        <output aria-live="polite" className="shrink-0 text-xs font-semibold text-ak-text tabular-nums">
          {p.ergebnisse.toLocaleString('de-DE')}
        </output>
        <RollReihe>
          <SchnellChips filters={p.filters} onChange={p.onFiltersChange} />
        </RollReihe>
        <DbSortWahl sort={p.sort} onChange={p.onSortChange} suche={!!p.suche.trim()} kompakt />
      </Werkzeugleiste>
      <FilterPopover offen={offen} schliessen={zu} ausloeser={pille} label={t('filter.button')}>
        <Abschnitte liste={abschnitte} />
        <FilterDetailsFeld meta={p.meta} filters={p.filters} onChange={p.onFiltersChange} showConfidence favoriteCount={p.favoriteCount} />
        <FilterFuss zuruecksetzen={() => p.onFiltersChange({ ...EMPTY_FILTERS, search: p.filters.search })} fertig={zu} />
      </FilterPopover>
    </SchnellInLeiste.Provider>
  )
}
