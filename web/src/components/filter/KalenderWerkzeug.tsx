import { useCallback, useRef, useState } from 'react'
import { activeFilterCount } from '../../lib/filters.ts'
import { useLang } from '../../lib/i18n.tsx'
import { FilterFeld } from '../kalender/FilterFeld.tsx'
import type { KalenderFilterProps } from '../kalender/KalenderFilter.tsx'
import { FilterPopover } from './FilterPopover.tsx'
import { AnsichtKnopf, HeuteChip } from './KalenderSteuerung.tsx'
import { FilterRund, Werkzeugleiste } from './Werkzeugleiste.tsx'

/** Der Kalender am Handy: runder Filter-Knopf, Ansichtswechsel und „‹ heute ›" in fester Reihe. Die Schnellfilter stehen im Filterfenster. */
export function KalenderWerkzeug(p: KalenderFilterProps) {
  const { t } = useLang()
  const [offen, setOffen] = useState(false)
  const knopf = useRef<HTMLButtonElement>(null)
  const zu = useCallback(() => setOffen(false), [])
  const anzahl = activeFilterCount(p.filters) + (p.tvAn ? 0 : 1)
  return (
    <>
      <Werkzeugleiste>
        <FilterRund ref={knopf} offen={offen} anzahl={anzahl} onClick={() => setOffen(!offen)} />
        <AnsichtKnopf view={p.view} onWoche={p.onWoche} onMonat={p.onMonat} />
        <HeuteChip view={p.view} date={p.date} onDate={p.onDate} />
      </Werkzeugleiste>
      <FilterPopover offen={offen} schliessen={zu} ausloeser={knopf} label={t('filter.button')}>
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
    </>
  )
}
