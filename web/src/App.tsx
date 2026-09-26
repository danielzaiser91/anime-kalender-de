import { useEffect, useMemo, useState } from 'react'
import type { Title } from '@shared/types.ts'
import type { Dataset } from './lib/data.ts'
import { EinstellungenDialog, CARTOONS_AUS, cartoonsAusGespeichert } from './components/Einstellungen.tsx'
import { loadAllTitles, loadCartoons, loadDataset, loadOhneSynchro, loadSynonyme } from './lib/data.ts'
import { filterEvents, filterTitles, toggleValue, type FilterState } from './lib/filters.ts'
import { useFavorites, useHidden } from './lib/favorites.ts'
import { speicherSichern, useNewsletterSync } from './lib/newsletterSync.ts'
import { usePushNachfuehren } from './lib/push-nachfuehren.ts'
import { useRoute, type ViewId } from './lib/router.ts'
import { tvPremiere } from './lib/tv-angabe.ts'
import { useLang } from './lib/i18n.tsx'
import { addDays, addMonths, startOfWeek, todayIso } from '@shared/time.ts'
import { Header } from './components/Header.tsx'
import { InstallDialog } from './components/InstallPrompt.tsx'
import { NewsView } from './components/NewsView.tsx'
import { cacheCoversForOffline } from './lib/pwa.ts'
import { coverBild } from './lib/cover.ts'
import { FilterBar } from './components/FilterBar.tsx'
import { KalenderBereich } from './components/kalender/KalenderBereich.tsx'
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
    <div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-ak-leise">
      <span className="size-6 animate-spin rounded-full border-2 border-ak-leise border-t-transparent" />
      {label}
    </div>
  )
}

/** Eine Wahl, die im Browser bleibt statt in der Adresse — wer einen Link teilt, teilt nicht seine Vorlieben. */
function useGemerkterSchalter(schluessel: string, lesen: () => boolean): [boolean, (an: boolean) => void] {
  const [wert, setWert] = useState(lesen)
  useEffect(() => {
    try {
      localStorage.setItem(schluessel, wert ? '1' : '0')
    } catch {
      /* Gesperrte Site-Daten: Die Wahl gilt dann für diese Sitzung. */
    }
  }, [schluessel, wert])
  return [wert, setWert]
}

function tvAusGespeichert(): boolean {
  try {
    return localStorage.getItem('tvAus') === '1'
  } catch {
    return false
  }
}

export default function App() {
  const { t } = useLang()
  const [data, setData] = useState<Dataset>()
  const [allTitles, setAllTitles] = useState<Title[]>()
  const [error, setError] = useState<string>()
  // Vorgabe aus: Wer die Datenbank öffnet, sucht meist einen bestimmten Titel (Daniel, 12.08.2026).
  const [grouped, setGrouped] = useState(() => localStorage.getItem('groupSeasons') === '1')
  /*
    Titel ohne deutsche Synchro mitzeigen — bewusst **nicht** gespeichert (Daniel, 13.08.2026: „not
    remembered upon reload"): Sie sind ein Werkzeug zum Merken, kein Teil der Antwort der Seite.
  */
  const [zeigeOhneSynchro, setZeigeOhneSynchro] = useState(false)
  const [ohneSynchro, setOhneSynchro] = useState<Title[]>()
  const [cartoons, setCartoons] = useState<Title[]>()
  /* Standardmäßig aus, die Cartoons also sichtbar (Daniel, 12.09.2026). */
  const [cartoonsAus, setCartoonsAus] = useGemerkterSchalter(CARTOONS_AUS, cartoonsAusGespeichert)
  const [einstellungenOffen, setEinstellungenOffen] = useState(false)
  /* TV-Termine ausblenden (Daniel, 16.09.2026). */
  const [tvAus, setTvAus] = useGemerkterSchalter('tvAus', tvAusGespeichert)
  const [route, navigate] = useRoute()
  const { favorites, toggle } = useFavorites()
  const { hidden, toggle: toggleHidden } = useHidden()
  // Hält Newsletter und Push aktuell — hier oben, damit es unabhängig von der geöffneten Ansicht greift.
  useNewsletterSync(favorites)
  usePushNachfuehren(favorites)
  // Bittet den Browser einmalig, den lokalen Speicher nicht selbst zu räumen (iOS-Safari: sieben Tage).
  useEffect(speicherSichern, [])
  const today = todayIso()

  useEffect(() => {
    loadDataset()
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [])

  useEffect(() => {
    localStorage.setItem('groupSeasons', grouped ? '1' : '0')
  }, [grouped])

  // Cover der aktuellen und nächsten Woche für unterwegs sichern — dieselbe Größe wie die Kachel.
  useEffect(() => {
    if (!data) return
    const from = startOfWeek(today)
    const to = addDays(from, 13)
    const urls = data.events
      .filter((e) => e.date >= from && e.date <= to)
      .map((e) => coverBild(data.titleById.get(e.titleId)?.coverImage, 160).src)
      .filter((url): url is string => Boolean(url))
    cacheCoversForOffline(urls)
  }, [data, today])

  useTastenSpruenge(route, navigate)

  // Die vollständige Titelliste kommt erst mit der Datenbank; der Kalender führt nur die Titel mit Termin.
  useEffect(() => {
    if (!data || allTitles || route.view !== 'datenbank') return
    /* Die Synonyme kommen mit — erst danach steht die Liste, damit die Suche sie kennt. */
    Promise.all([loadAllTitles(data), loadSynonyme()])
      .then(([alle]) => setAllTitles(alle))
      .catch(() => setAllTitles(data.titles))
  }, [data, allTitles, route.view])

  // Die Titel ohne Synchro kommen erst, wenn jemand sie sehen will — und dann genau einmal.
  useEffect(() => {
    if (!data || !zeigeOhneSynchro || ohneSynchro) return
    loadOhneSynchro(data).then(setOhneSynchro)
  }, [data, zeigeOhneSynchro, ohneSynchro])

  /* Cartoons haben keinen Termin; geladen werden sie nur für die Datenbank und für einen direkt geöffneten Cartoon (18.09.2026). */
  const brauchtCartoons = route.view === 'datenbank' || (route.title !== undefined && !!data && !data.titleById.has(route.title))
  useEffect(() => {
    if (!data || cartoons || !brauchtCartoons) return
    loadCartoons(data).then(setCartoons)
  }, [data, cartoons, brauchtCartoons])

  const events = useMemo(
    () =>
      data
        ? filterEvents(data, route.filters, today, favorites).filter(
            /* Ausgeschaltet bleiben Premieren sichtbar (Daniel, 19.09.2026). */
            (e) => !tvAus || e.platform !== 'tv' || tvPremiere(e, data),
          )
        : [],
    [data, route.filters, today, favorites, tvAus],
  )
  /* Für die Datumsauswahl: der Bereich aus allen Terminen, die Zählung aus der gefilterten Ansicht. */
  const termintage = useMemo(
    () => ({ alle: data ? data.events.map((e) => e.date) : [], sichtbar: events.map((e) => e.date) }),
    [data, events],
  )
  const titles = useMemo(() => {
    if (!data) return []
    const basis = allTitles ?? data.titles
    const mitOhne = zeigeOhneSynchro && ohneSynchro ? [...basis, ...ohneSynchro] : basis
    const quelle = !cartoonsAus && cartoons ? [...mitOhne, ...cartoons] : mitOhne
    return filterTitles(quelle, data, route.filters, today, favorites)
  }, [data, allTitles, ohneSynchro, zeigeOhneSynchro, cartoons, cartoonsAus, route.filters, today, favorites])

  const openTitleId = useMemo(() => {
    if (route.title) return route.title
    if (route.release && data) return data.releaseBySlug.get(route.release)?.titleId
    return undefined
  }, [route.release, route.title, data])

  const setFilters = (filters: FilterState) => navigate({ filters })
  const setView = (view: ViewId) => navigate({ view, release: undefined, title: undefined })
  /* Gesucht wird in Kalender und Datenbank; von anderen Seiten aus führt die Suche in die Datenbank. */
  const setSuche = (search: string) =>
    navigate({
      filters: { ...route.filters, search },
      ...(['woche', 'monat', 'datenbank'].includes(route.view) || !search ? {} : { view: 'datenbank' as ViewId }),
    })

  if (error) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <h1 className="text-lg font-semibold text-red-400">{t('app.loadError')}</h1>
        <p className="mt-2 text-sm text-ak-leise">{error}</p>
        <p className="mt-4 text-xs text-ak-leise">
          {t('app.loadHint')} <code>npm run data:all</code>
        </p>
      </div>
    )
  }

  if (!data) return <Spinner label={t('app.loading')} />

  const kalender = route.view === 'woche' || route.view === 'monat'

  return (
    <div className="flex min-h-full flex-col pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
      <Header
        view={route.view}
        onView={setView}
        onStart={() => navigate({ view: 'woche', date: todayIso(), release: undefined, title: undefined })}
        suche={route.filters.search}
        setSuche={setSuche}
        favorites={favorites}
        einstellungen={() => setEinstellungenOffen(true)}
      />
      <EinstellungenDialog
        offen={einstellungenOffen}
        schliessen={() => setEinstellungenOffen(false)}
        cartoonsAus={cartoonsAus}
        setCartoonsAus={setCartoonsAus}
      />

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 lg:px-10">
        {kalender && (
          <KalenderBereich
            data={data}
            route={route}
            navigate={navigate}
            events={events}
            favorites={favorites}
            hidden={hidden}
            onToggleFavorite={toggle}
            onToggleHidden={toggleHidden}
            tvAn={!tvAus}
            setTvAn={(an) => setTvAus(!an)}
            termine={termintage}
          />
        )}

        {route.view === 'datenbank' && (
          <>
            {/* Eine Überschrift, die keiner sieht und viele brauchen: der Sprungpunkt für Vorlesende (20.08.2026). */}
            <h1 className="sr-only">{`Anime-Kalender DE — ${t('view.datenbank')}`}</h1>
            <div className="mb-4">
              <FilterBar meta={data.meta} filters={route.filters} onChange={setFilters} showConfidence favoriteCount={favorites.size} />
            </div>
            {allTitles ? (
              <DatabaseView
                data={data}
                titles={titles}
                grouped={grouped}
                onGroupedChange={setGrouped}
                ohneSynchro={zeigeOhneSynchro}
                onOhneSynchroChange={setZeigeOhneSynchro}
                ohneSynchroLaedt={zeigeOhneSynchro && !ohneSynchro}
                favorites={favorites}
                hidden={hidden}
                onToggleFavorite={toggle}
                onToggleHidden={toggleHidden}
                onOpenTitle={(id) => navigate({ title: id, release: undefined })}
                gesucht={Boolean(route.filters.search.trim())}
                gewaehlt={route.sort}
                onSortChange={(sort) => navigate({ sort })}
              />
            ) : (
              <Spinner label={t('app.loadingTitles', { count: data.meta.titleCount.toLocaleString('de-DE') })} />
            )}
          </>
        )}

        {route.view === 'news' && <NewsView data={data} oeffne={(id: number) => navigate({ title: id })} />}
        {route.view === 'abo' && <SubscribeView meta={data.meta} />}
        {route.view === 'newsletter' && <NewsletterView meta={data.meta} data={data} />}
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
          terminOffen={Boolean(route.release)}
          favorites={favorites}
          hidden={hidden}
          onToggleFavorite={toggle}
          onToggleHidden={toggleHidden}
          onClose={() => navigate({ release: undefined, title: undefined })}
          /*
            Ein Wechsel in der Reihe führt auf dieselbe Adressform wie ein Klick im Kalender: Hat der
            Titel ein Release, gewinnt dessen Slug (eigene Teilen-Seite), sonst bleibt die Kennung
            (Daniel, 03.09.2026: zwei Adressen für dieselbe Ansicht — „wieso?").
          */
          onOpenTitle={(id) => {
            const slug = data?.releases.find((r) => r.titleId === id)?.slug
            navigate(slug ? { release: slug, title: undefined } : { title: id, release: undefined })
          }}
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

/** Wochen- und Monatssprünge per Tastatur (← → T), solange kein Textfeld den Fokus hat. */
function useTastenSpruenge(route: ReturnType<typeof useRoute>[0], navigate: ReturnType<typeof useRoute>[1]) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return
      if (route.release || route.title) return
      if (route.view !== 'woche' && route.view !== 'monat') return
      const isMonth = route.view === 'monat'
      if (e.key === 'ArrowLeft') navigate({ date: isMonth ? addMonths(route.date, -1) : addDays(route.date, -7) })
      else if (e.key === 'ArrowRight') navigate({ date: isMonth ? addMonths(route.date, 1) : addDays(route.date, 7) })
      else if (e.key.toLowerCase() === 't') navigate({ date: todayIso() })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [route, navigate])
}
