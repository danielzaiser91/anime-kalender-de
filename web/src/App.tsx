import { useEffect, useMemo, useState } from 'react'
import type { Title } from '@shared/types.ts'
import type { Dataset } from './lib/data.ts'
import { loadAllTitles, loadDataset } from './lib/data.ts'
import { filterEvents, filterTitles, toggleValue, type FilterState } from './lib/filters.ts'
import { useRoute, type ViewId } from './lib/router.ts'
import { addDays, addMonths, todayIso } from '@shared/time.ts'
import { Header, Legend } from './components/Header.tsx'
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
  const [data, setData] = useState<Dataset>()
  const [allTitles, setAllTitles] = useState<Title[]>()
  const [error, setError] = useState<string>()
  const [route, navigate] = useRoute()
  const today = todayIso()

  useEffect(() => {
    loadDataset().then(setData).catch((e: Error) => setError(e.message))
  }, [])

  // Wochen- und Monatssprünge per Tastatur, solange kein Textfeld den Fokus hat.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return
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
    loadAllTitles(data).then(setAllTitles).catch(() => setAllTitles(data.titles))
  }, [data, allTitles, route.view])

  const events = useMemo(
    () => (data ? filterEvents(data, route.filters, today) : []),
    [data, route.filters, today],
  )
  const titles = useMemo(
    () => (data ? filterTitles(allTitles ?? data.titles, data, route.filters, today) : []),
    [data, allTitles, route.filters, today],
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
        <h1 className="text-lg font-semibold text-red-400">Daten konnten nicht geladen werden</h1>
        <p className="mt-2 text-sm text-slate-400">{error}</p>
        <p className="mt-4 text-xs text-slate-500">
          Wurde die Datenpipeline schon ausgeführt? <code>npm run data:all</code>
        </p>
      </div>
    )
  }

  if (!data) return <Spinner label="Kalender wird geladen …" />

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
            />
            {isCalendar && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Legend />
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {events.length} Termine im Filter · Tasten ← → T
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
            onOpen={(release) => navigate({ release, title: undefined })}
          />
        )}

        {route.view === 'monat' && (
          <MonthView
            events={events}
            anchorDate={route.date}
            onOpen={(release) => navigate({ release, title: undefined })}
            onPickDay={(d) => navigate({ view: 'woche', date: d })}
          />
        )}

        {route.view === 'agenda' && (
          <AgendaView
            data={data}
            events={events}
            anchorDate={route.date}
            onOpen={(release) => navigate({ release, title: undefined })}
          />
        )}

        {route.view === 'datenbank' &&
          (allTitles ? (
            <DatabaseView
              data={data}
              titles={titles}
              onOpenTitle={(id) => navigate({ title: id, release: undefined })}
            />
          ) : (
            <Spinner label={`${data.meta.titleCount.toLocaleString('de-DE')} Einträge werden geladen …`} />
          ))}

        {route.view === 'abo' && <SubscribeView meta={data.meta} />}
        {route.view === 'newsletter' && <NewsletterView meta={data.meta} />}
        {route.view === 'impressum' && <ImpressumView />}
        {route.view === 'datenschutz' && <DatenschutzView />}
      </main>

      <Footer meta={data.meta} />

      {openTitleId !== undefined && (
        <DetailPanel
          data={data}
          titleId={openTitleId}
          onClose={() => navigate({ release: undefined, title: undefined })}
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
