import { useMemo, useState } from 'react'
import type { ReleaseEvent } from '@shared/types.ts'
import type { Dataset } from '../../lib/data.ts'
import type { AppRoute } from '../../lib/router.ts'
import { activeFilterCount, type FilterState } from '../../lib/filters.ts'
import { addDays, monthName, startOfMonth, startOfWeek, todayIso } from '@shared/time.ts'
import { useLang } from '../../lib/i18n.tsx'
import { merkeZielTag } from '../../lib/ziel-tag.ts'
import { WeekView } from '../WeekView.tsx'
import { MonthView } from '../MonthView.tsx'
import { KalenderKopf, wochenSpanne } from './KalenderKopf.tsx'
import { FilterFeld } from './FilterFeld.tsx'
import { AktiveFilter } from './AktiveFilter.tsx'
import { zaehlung } from './Marken.tsx'

export interface KalenderBereichProps {
  data: Dataset
  route: AppRoute
  navigate: (next: Partial<AppRoute>) => void
  /** Gefiltert, samt TV-Schalter. */
  events: ReleaseEvent[]
  favorites: Set<number>
  hidden: Set<number>
  onToggleFavorite: (id: number) => void
  onToggleHidden: (id: number) => void
  tvAn: boolean
  setTvAn: (an: boolean) => void
  termine: { alle: string[]; sichtbar: string[] }
}

/** Von–bis des gezeigten Zeitraums: die Woche des Ankers oder sein Monat. */
function spanne(route: AppRoute): [string, string] {
  if (route.view === 'monat') {
    const von = startOfMonth(route.date)
    const naechster = startOfMonth(addDays(von, 31))
    return [von, addDays(naechster, -1)]
  }
  const montag = startOfWeek(route.date)
  return [montag, addDays(montag, 6)]
}

/** Der Kalender: Kopf, Filter und die Woche oder der Monat darunter. */
export function KalenderBereich(p: KalenderBereichProps) {
  const { t } = useLang()
  const [filterOffen, setFilterOffen] = useState(false)
  const { route, navigate } = p
  const monat = route.view === 'monat'
  const [von, bis] = spanne(route)
  const zeitraum = useMemo(() => p.data.events.filter((e) => e.date >= von && e.date <= bis), [p.data, von, bis])
  const imZeitraum = useMemo(() => p.events.filter((e) => e.date >= von && e.date <= bis), [p.events, von, bis])
  const stream = imZeitraum.filter((e) => e.platform !== 'tv').length
  const tv = imZeitraum.length - stream
  const unterzeile = monat
    ? zaehlung(stream, p.tvAn ? tv : 0, t)
    : wochenSpanne(route.date)
  const setFilters = (filters: FilterState) => navigate({ filters })
  const oeffnen = (release: string) => navigate({ release, title: undefined })
  const zurWoche = (datum: string) => {
    merkeZielTag(datum)
    navigate({ view: 'woche', date: datum })
  }
  const heute = todayIso()

  return (
    <div className="flex flex-col gap-4">
      <KalenderKopf
        view={route.view}
        date={route.date}
        unterzeile={unterzeile}
        filterOffen={filterOffen}
        filterAnzahl={activeFilterCount(route.filters) + (p.tvAn ? 0 : 1)}
        termine={p.termine}
        onFilter={() => setFilterOffen(!filterOffen)}
        onDate={(date) => navigate({ date })}
        onWoche={() => monat && zurWoche(heute.slice(0, 7) === route.date.slice(0, 7) ? heute : startOfMonth(route.date))}
        onMonat={() => navigate({ view: 'monat' })}
      />
      {filterOffen ? (
        <FilterFeld
          data={p.data}
          filters={route.filters}
          onChange={setFilters}
          tvAn={p.tvAn}
          setTvAn={p.setTvAn}
          favoriteCount={p.favorites.size}
          zeitraum={zeitraum}
          treffer={imZeitraum.length}
          zeitraumWort={monat ? t('filter.imMonat', { monat: monthName(Number(von.slice(5, 7)) - 1) }) : t('filter.inDieserWoche')}
          schliessen={() => setFilterOffen(false)}
        />
      ) : (
        <AktiveFilter filters={route.filters} onChange={setFilters} tvAn={p.tvAn} setTvAn={p.setTvAn} />
      )}
      {monat ? (
        <MonthView data={p.data} events={p.events} anchorDate={route.date} hidden={p.hidden} onOpen={oeffnen} onPickDay={zurWoche} />
      ) : (
        <WeekView
          data={p.data}
          events={p.events}
          anchorDate={route.date}
          favorites={p.favorites}
          hidden={p.hidden}
          tvAn={p.tvAn}
          gefiltert={activeFilterCount(route.filters) > 0}
          onToggleFavorite={p.onToggleFavorite}
          onToggleHidden={p.onToggleHidden}
          onOpen={oeffnen}
        />
      )}
    </div>
  )
}
