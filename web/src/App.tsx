import { useEffect, useMemo, useState } from 'react'
import type { Title } from '@shared/types.ts'
import type { Dataset } from './lib/data.ts'
import { loadAllTitles, loadDataset } from './lib/data.ts'
import { filterEvents, filterTitles, toggleValue, type FilterState } from './lib/filters.ts'
import { useFavorites, useHidden } from './lib/favorites.ts'
import { useNewsletterSync } from './lib/newsletterSync.ts'
import { useRoute, type ViewId } from './lib/router.ts'
import { useLang } from './lib/i18n.tsx'
import { addDays, addMonths, startOfWeek, todayIso } from '@shared/time.ts'
import { Header, Legend } from './components/Header.tsx'
import { InstallDialog } from './components/InstallPrompt.tsx'
import { cacheCoversForOffline } from './lib/pwa.ts'
import { FilterBar } from './components/FilterBar.tsx'
import { WeekView } from './components/WeekView.tsx'
import { MonthView } from './components/MonthView.tsx'
import { AgendaView } from './components/AgendaView.tsx'
import { DatabaseView } from './components/DatabaseView.tsx'
import { DetailPanel } from './components/DetailPanel.tsx'
import {
  DatenschutzView,
  Footer,
  ImpressumView,
  NewsletterView,
  SourcesView,
  SubscribeView,
} from './components/StaticViews.tsx'

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-slate-500">
      <span className="size-6 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
      {label}
    </div>
  )
}

export default function App() {
  const { t } = useLang()
  const [data, setData] = useState<Dataset>()
  const [allTitles, setAllTitles] = useState<Title[]>()
  const [error, setError] = useState<string>()
  const [grouped, setGrouped] = useState(() => localStorage.getItem('groupSeasons') !== '0')
  const [route, navigate] = useRoute()
  const { favorites, toggle } = useFavorites()
  const { hidden, toggle: toggleHidden } = useHidden()
  // Hält die im Newsletter hinterlegten Favoriten aktuell — sitzt hier oben,
  // damit es unabhängig von der geöffneten Ansicht greift.
  useNewsletterSync(favorites)
  const today = todayIso()

  useEffect(() => {
    loadDataset()
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [])

  useEffect(() => {
    localStorage.setItem('groupSeasons', grouped ? '1' : '0')
  }, [grouped])

  // Cover der aktuellen und nächsten Woche für unterwegs sichern. Erst wenn
  // die Daten stehen — vorher weiß niemand, welche Bilder gebraucht werden.
  useEffect(() => {
    if (!data) return
    const from = startOfWeek(today)
    const to = addDays(from, 13)
    const urls = data.events
      .filter((e) => e.date >= from && e.date <= to)
      .map((e) => data.titleById.get(e.titleId)?.coverImage)
      .filter((url): url is string => Boolean(url))
    cacheCoversForOffline(urls)
  }, [data, today])

  // Wochen- und Monatssprünge per Tastatur, solange kein Textfeld den Fokus hat.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)
        return
      if (route.release || route.title) return
      const isMonth = route.view === 'monat'
      if (e.key === 'ArrowLeft') navigate({ date: isMonth ? addMonths(route.date, -1) : addDays(route.date, -7) })
      else if (e.key === 'ArrowRight') navigate({ date: isMonth ? addMonths(route.date, 1) : addDays(route.date, 7) })
      else if (e.key.toLowerCase() === 't') navigate({ date: todayIso() })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [route, navigate])

  // Die vollständige Titelliste kommt erst, wenn sie gebraucht wird.
  useEffect(() => {
    if (!data || allTitles || route.view !== 'datenbank') return
    loadAllTitles(data)
      .then(setAllTitles)
      .catch(() => setAllTitles(data.titles))
  }, [data, allTitles, route.view])

  const events = useMemo(
    () => (data ? filterEvents(data, route.filters, today, favorites) : []),
    [data, route.filters, today, favorites],
  )
  const titles = useMemo(
    () => (data ? filterTitles(allTitles ?? data.titles, data, route.filters, today, favorites) : []),
    [data, allTitles, route.filters, today, favorites],
  )

  const openTitleId = useMemo(() => {
    if (route.title) return route.title
    if (route.release && data) return data.releaseBySlug.get(route.release)?.titleId
    return undefined
  }, [route.release, route.title, data])

  const setFilters = (filters: FilterState) => navigate({ filters })
  const setView = (view: ViewId) => navigate({ view, release: undefined, title: undefined })

  if (error) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <h1 className="text-lg font-semibold text-red-400">{t('app.loadError')}</h1>
        <p className="mt-2 text-sm text-slate-400">{error}</p>
        <p className="mt-4 text-xs text-slate-500">
          {t('app.loadHint')} <code>npm run data:all</code>
        </p>
      </div>
    )
  }

  if (!data) return <Spinner label={t('app.loading')} />

  const isCalendar = route.view === 'woche' || route.view === 'monat' || route.view === 'agenda'
  const showFilters = isCalendar || route.view === 'datenbank'

  return (
    <div className="flex min-h-full flex-col">
      <Header view={route.view} date={route.date} onView={setView} onDate={(d) => navigate({ date: d })} />

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-4">
        {showFilters && (
          <div className="mb-4 flex flex-col gap-2">
            <FilterBar
              meta={data.meta}
              filters={route.filters}
              onChange={setFilters}
              showConfidence={route.view === 'datenbank'}
              favoriteCount={favorites.size}
            />
            {isCalendar && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Legend />
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t('legend.count', { count: events.length })}
                </span>
              </div>
            )}
          </div>
        )}

        {route.view === 'woche' && (
          <WeekView
            data={data}
            events={events}
            anchorDate={route.date}
            favorites={favorites}
            hidden={hidden}
            onToggleFavorite={toggle}
            onToggleHidden={toggleHidden}
            onOpen={(release) => navigate({ release, title: undefined })}
          />
        )}

        {route.view === 'monat' && (
          <MonthView
            events={events}
            anchorDate={route.date}
            favorites={favorites}
            hidden={hidden}
            onOpen={(release) => navigate({ release, title: undefined })}
            onPickDay={(d) => navigate({ view: 'woche', date: d })}
          />
        )}

        {route.view === 'agenda' && (
          <AgendaView
            data={data}
            events={events}
            anchorDate={route.date}
            favorites={favorites}
            hidden={hidden}
            onToggleFavorite={toggle}
            onToggleHidden={toggleHidden}
            onOpen={(release) => navigate({ release, title: undefined })}
          />
        )}

        {route.view === 'datenbank' &&
          (allTitles ? (
            <DatabaseView
              data={data}
              titles={titles}
              grouped={grouped}
              onGroupedChange={setGrouped}
              favorites={favorites}
              hidden={hidden}
              onToggleFavorite={toggle}
              onToggleHidden={toggleHidden}
              onOpenTitle={(id) => navigate({ title: id, release: undefined })}
            />
          ) : (
            <Spinner label={t('app.loadingTitles', { count: data.meta.titleCount.toLocaleString('de-DE') })} />
          ))}

        {route.view === 'abo' && <SubscribeView meta={data.meta} />}
        {route.view === 'newsletter' && <NewsletterView meta={data.meta} />}
        {route.view === 'quellen' && <SourcesView meta={data.meta} />}
        {route.view === 'impressum' && <ImpressumView />}
        {route.view === 'datenschutz' && <DatenschutzView />}
      </main>

      <Footer meta={data.meta} />

      <InstallDialog />

      {openTitleId !== undefined && (
        <DetailPanel
          data={data}
          titleId={openTitleId}
          favorites={favorites}
          hidden={hidden}
          onToggleFavorite={toggle}
          onToggleHidden={toggleHidden}
          onClose={() => navigate({ release: undefined, title: undefined })}
          onOpenTitle={(id) => navigate({ title: id, release: undefined })}
          onFilterBy={(kind, value) => {
            const filters =
              kind === 'genre'
                ? { ...route.filters, genres: toggleValue(route.filters.genres, value) }
                : { ...route.filters, keywords: toggleValue(route.filters.keywords, value) }
            navigate({ filters, release: undefined, title: undefined, view: 'datenbank' })
          }}
        />
      )}
    </div>
  )
}
