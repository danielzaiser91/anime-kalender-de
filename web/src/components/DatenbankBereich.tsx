import { useMemo } from 'react'
import type { Title } from '@shared/types.ts'
import { zaehleHerkunft } from '../lib/herkunft.ts'
import { HerkunftZaehlungContext } from '../lib/herkunft-zaehlung.ts'
import type { Dataset } from '../lib/data.ts'
import type { FilterState } from '../lib/filters.ts'
import type { Fundstelle } from '../lib/search.ts'
import type { AppRoute } from '../lib/router.ts'
import { useLang } from '../lib/i18n.tsx'
import { useMobil } from '../lib/use-mobil.ts'
import { SuchfundstellenContext } from '../lib/such-kontext.ts'
import { SucheLeerenContext } from '../lib/suche-leeren-kontext.ts'
import { DatabaseView } from './DatabaseView.tsx'
import { FilterBarDock } from './FilterBar.tsx'
import type { HinweisLoesen } from './SuchHinweis.tsx'
import { SprecherLeiste } from './SprecherLeiste.tsx'
import { Ladeanzeige } from './ui.tsx'
import { WasGuckenKnopf } from './WasGuckenKnopf.tsx'

export interface DatenbankBereichProps {
  data: Dataset
  route: AppRoute
  navigate: (next: Partial<AppRoute>) => void
  setFilters: (filters: FilterState) => void
  /** Die vollständige Titelliste ist da (sonst Ladeanzeige). */
  geladen: boolean
  titles: { liste: Title[]; fundstellen: Map<string, Fundstelle[]> }
  /** Alle Titel der Ansicht vor dem Filter — daraus die Zahlen an der Herkunft. */
  quelle: Title[]
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

/**
 * Der Knopf des Suchhinweises: Filter und Schalter „ohne Synchro“ in einem Adresswechsel (zwei getrennte Aufrufe schrieben je die ganze
 * Adresse aus ihrem alten Stand). Ohne Filteränderung genügt der Schalter allein.
 */
export function loeseHinweis(p: DatenbankBereichProps): HinweisLoesen {
  return (filters, schalterAn) => {
    if (!filters) return p.onOhneSynchroChange(true)
    p.navigate({ filters: { ...filters, search: p.route.filters.search }, ...(schalterAn ? { ohne: true as const } : {}) })
  }
}

/** Die Datenbank: Filterfeld und Titelraster. */
export function DatenbankBereich(p: DatenbankBereichProps) {
  const { t } = useLang()
  const { data, route } = p
  const mobil = useMobil()
  const herkunftZaehlung = useMemo(() => zaehleHerkunft(p.quelle), [p.quelle])
  const ansicht = (
    <>
      <WasGuckenKnopf navigate={p.navigate} />
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
            filters={route.filters}
            onFiltersChange={p.setFilters}
            onHinweisLoesen={loeseHinweis(p)}
          />
        </SuchfundstellenContext.Provider>
      ) : (
        <Ladeanzeige label={t('app.loadingTitles', { count: data.meta.titleCount.toLocaleString('de-DE') })} />
      )}
    </>
  )
  return (
    <HerkunftZaehlungContext.Provider value={herkunftZaehlung}>
      <SucheLeerenContext.Provider value={() => p.navigate({ filters: { ...route.filters, search: '' } })}>
        {/* Eine Überschrift, die keiner sieht und viele brauchen: der Sprungpunkt für Vorlesende (20.08.2026). */}
        <h1 className="sr-only">{`Anime-Kalender DE — ${t('view.datenbank')}`}</h1>
        {/* Am Rechner dockt das Filterfeld unten an; am Handy steht die Werkzeugleiste oben (`DbKopfbereich`). */}
        {mobil ? (
          <SprecherLeiste data={data} filters={route.filters}>{ansicht}</SprecherLeiste>
        ) : (
          <>
            <SprecherLeiste data={data} filters={route.filters}><FilterBarDock meta={data.meta} filters={route.filters} onChange={p.setFilters} showConfidence favoriteCount={p.favorites.size} /></SprecherLeiste>
            {ansicht}
          </>
        )}
      </SucheLeerenContext.Provider>
    </HerkunftZaehlungContext.Provider>
  )
}
