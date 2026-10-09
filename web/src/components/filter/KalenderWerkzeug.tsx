import { useCallback, useRef, useState } from 'react'
import { activeFilterCount } from '../../lib/filters.ts'
import { useLang } from '../../lib/i18n.tsx'
import { FilterFeld } from '../kalender/FilterFeld.tsx'
import { SteuerElemente } from '../kalender/KalenderKopf.tsx'
import type { KalenderFilterProps } from '../kalender/KalenderFilter.tsx'
import { FilterPopover } from './FilterPopover.tsx'
import { SchnellChips } from './SchnellChips.tsx'
import { SchnellInLeiste } from './schnell-in-leiste.ts'
import { FilterPille, RollReihe, Werkzeugleiste } from './Werkzeugleiste.tsx'

/** Der Kalender am Handy: Filter-Pille, dann in einer rollbaren Reihe Woche/Monat, Blättern, „heute" und die Schnellfilter. */
export function KalenderWerkzeug(p: KalenderFilterProps) {
  const { t } = useLang()
  const [offen, setOffen] = useState(false)
  const pille = useRef<HTMLButtonElement>(null)
  const zu = useCallback(() => setOffen(false), [])
  const anzahl = activeFilterCount(p.filters) + (p.tvAn ? 0 : 1)
  return (
    <SchnellInLeiste.Provider value>
      <Werkzeugleiste>
        <FilterPille ref={pille} offen={offen} anzahl={anzahl} onClick={() => setOffen(!offen)} />
        <RollReihe>
          <SteuerElemente
            view={p.view}
            date={p.date}
            filterOffen={offen}
            filterAnzahl={anzahl}
            termine={p.termine}
            onFilter={() => setOffen(!offen)}
            onDate={p.onDate}
            onWoche={p.onWoche}
            onMonat={p.onMonat}
          />
          <SchnellChips filters={p.filters} onChange={p.setFilters} tvAn={p.tvAn} setTvAn={p.setTvAn} />
        </RollReihe>
      </Werkzeugleiste>
      <FilterPopover offen={offen} schliessen={zu} ausloeser={pille} label={t('filter.button')}>
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
          schliessen={zu}
        />
      </FilterPopover>
    </SchnellInLeiste.Provider>
  )
}
