import type { Title } from '@shared/types.ts'
import type { Dataset } from '../lib/data.ts'
import type { FilterState } from '../lib/filters.ts'
import type { Fundstelle } from '../lib/search.ts'
import type { AppRoute } from '../lib/router.ts'
import { useLang } from '../lib/i18n.tsx'
import { SuchfundstellenContext } from '../lib/such-kontext.ts'
import { DatabaseView } from './DatabaseView.tsx'
import { FilterBarDock } from './FilterBar.tsx'
import { SprecherLeiste } from './SprecherLeiste.tsx'

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-ak-leise">
      <span className="size-6 animate-spin rounded-full border-2 border-ak-leise border-t-transparent" />
      {label}
    </div>
  )
}

export interface DatenbankBereichProps {
  data: Dataset
  route: AppRoute
  navigate: (next: Partial<AppRoute>) => void
  setFilters: (filters: FilterState) => void
  /** Die vollständige Titelliste ist da (sonst Spinner). */
  geladen: boolean
  titles: { liste: Title[]; fundstellen: Map<string, Fundstelle[]> }
  grouped: boolean
  onGroupedChange: (next: boolean) => void
  ohneSynchro: boolean
  onOhneSynchroChange: (next: boolean) => void
  laedt: boolean
  favorites: Set<number>
  hidden: Set<number>
  onToggleFavorite: (id: number) => void
  onToggleHidden: (id: number) => void
}

/** Die Datenbank: Filterfeld und Titelraster. */
export function DatenbankBereich(p: DatenbankBereichProps) {
  const { t } = useLang()
  const { data, route } = p
  return (
    <>
      {/* Eine Überschrift, die keiner sieht und viele brauchen: der Sprungpunkt für Vorlesende (20.08.2026). */}
      <h1 className="sr-only">{`Anime-Kalender DE — ${t('view.datenbank')}`}</h1>
      {/* Das Filterfeld der Datenbank dockt unten an — wie im Kalender. */}
      <SprecherLeiste data={data} filters={route.filters}><FilterBarDock meta={data.meta} filters={route.filters} onChange={p.setFilters} showConfidence favoriteCount={p.favorites.size} /></SprecherLeiste>
      {p.geladen ? (
        <SuchfundstellenContext.Provider value={p.titles.fundstellen}>
          <DatabaseView
            data={data}
            titles={p.titles.liste}
            grouped={p.grouped}
            onGroupedChange={p.onGroupedChange}
            ohneSynchro={p.ohneSynchro}
            onOhneSynchroChange={p.onOhneSynchroChange}
            ohneSynchroLaedt={p.laedt}
            favorites={p.favorites}
            hidden={p.hidden}
            onToggleFavorite={p.onToggleFavorite}
            onToggleHidden={p.onToggleHidden}
            onOpenTitle={(id) => p.navigate({ title: id, disc: undefined })}
            suche={route.filters.search}
            gewaehlt={route.sort}
            onSortChange={(sort) => p.navigate({ sort })}
          />
        </SuchfundstellenContext.Provider>
      ) : (
        <Spinner label={t('app.loadingTitles', { count: data.meta.titleCount.toLocaleString('de-DE') })} />
      )}
    </>
  )
}
