import {
  type PlatformId,
  PLATFORMS,
  RELEASE_TYPES,
  type ReleaseType,
  type DataMeta,
  type Fsk,
  type ReleaseStatus,
} from '@shared/types.ts'
import { Chip, Tooltip } from './ui.tsx'
import { filterMode, modusVon, toggleFilter, type ModusFeld, type FilterState, type ListKey } from '../lib/filters.ts'
import type { Translate } from '../lib/i18n.tsx'
import type { Dispatch, SetStateAction, ReactNode } from 'react'
import { useLang } from '../lib/i18n.tsx'
import { useState } from 'react'

export const FSK_OPTIONS: Fsk[] = [0, 6, 12, 16, 18]

export const STATUS_OPTIONS: ReleaseStatus[] = ['airing', 'tba', 'abgeschlossen', 'erschienen', 'unbekannt']

export const KEYWORD_PREVIEW = 24

export const STATUS_LABEL_KEY = {
  airing: 'status.airing',
  abgeschlossen: 'status.abgeschlossen',
  tba: 'status.tba',
  erschienen: 'status.erschienen',
  unbekannt: 'status.unbekannt',
} as const

/**
 * **Der UND/ODER-Schalter einer Kategorie.**
 *
 * Er erscheint erst ab der zweiten gewählten Pill: Bei einer einzigen bewirkt er
 * nichts, und ein Schalter ohne Wirkung ist Rauschen.
 */
function ModusSchalter({ wert, setzen }: { wert: 'und' | 'oder'; setzen: (w: 'und' | 'oder') => void }) {
  const knopf = (w: 'und' | 'oder', text: string, titel: string) => (
    <Tooltip text={titel} eigenerFokus>
      <button
        type="button"
        onClick={() => setzen(w)}
        aria-pressed={wert === w}
        className={
          'rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider transition ' +
          (wert === w ? 'bg-slate-600 text-slate-100' : 'text-slate-500 hover:text-slate-300')
        }
      >
        {text}
      </button>
    </Tooltip>
  )
  return (
    <span className="ml-1 inline-flex items-center gap-px rounded bg-slate-800/70 p-px">
      {knopf('oder', 'egal', 'Mindestens eines der gewählten')}
      {knopf('und', 'alle', 'Alle gewählten zusammen')}
    </span>
  )
}

export function Group({
  label,
  children,
  modus,
}: {
  label: string
  children: ReactNode
  modus?: { anzahl: number; wert: 'und' | 'oder'; setzen: (w: 'und' | 'oder') => void }
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center text-[10px] font-semibold uppercase tracking-[0.14em] text-ak-leise">
        {label}
        {modus && modus.anzahl > 1 ? <ModusSchalter wert={modus.wert} setzen={modus.setzen} /> : null}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

/**
 * **„Meine Anbieter" — die eigenen Abos als ein Klick** (18.09.2026).
 *
 * Wer Netflix und Crunchyroll hat, wählt beide bei jedem Besuch neu aus.
 * Gespeichert wird im Browser, nicht in der Adresse — eine Vorliebe ist keine
 * Ansicht.
 */
const MEINE_ANBIETER = 'meineAnbieter'

function meineAnbieterLesen(verfuegbar: PlatformId[]): PlatformId[] {
  try {
    const roh = JSON.parse(localStorage.getItem(MEINE_ANBIETER) ?? '[]') as unknown
    return Array.isArray(roh) ? verfuegbar.filter((p) => roh.includes(p)) : []
  } catch {
    return []
  }
}

export function MeineAnbieter({
  aktuell,
  verfuegbar,
  setzen,
}: {
  aktuell: PlatformId[]
  verfuegbar: PlatformId[]
  setzen: (platforms: PlatformId[]) => void
}) {
  const { t } = useLang()
  const [gemerkt, setGemerkt] = useState(() => meineAnbieterLesen(verfuegbar))
  const gleich = gemerkt.length === aktuell.length && gemerkt.every((p) => aktuell.includes(p))
  const merken = () => {
    try {
      localStorage.setItem(MEINE_ANBIETER, JSON.stringify(aktuell))
    } catch {
      /* Gesperrter Speicher: dann gilt die Auswahl nur für diesen Besuch. */
    }
    setGemerkt([...aktuell])
  }
  const knopf =
    'cursor-pointer rounded-full border border-dashed border-ak-rand px-2.5 py-0.5 text-xs text-ak-leise transition hover:bg-ak-flaeche-2'
  if (gemerkt.length && !gleich)
    return (
      <button type="button" className={knopf} onClick={() => setzen(gemerkt)} title={gemerkt.map((p) => PLATFORMS[p].name).join(', ')}>
        ★ {t('filter.meineAnbieter')}
      </button>
    )
  if (aktuell.length && !gleich)
    return (
      <button type="button" className={knopf} onClick={merken}>
        ☆ {t('filter.meineAnbieterMerken')}
      </button>
    )
  return null
}

/**
 * **Was gerade greift, steht als entfernbarer Streifen darüber** — siehe
 * `kalender/AktiveFilter.tsx` (Kalender) bzw. `FilterBar.tsx` (Datenbank).
 */
export function FilterDetails({
  t,
  setMode,
  mode,
  modusVon2,
  filters,
  meta,
  set,
  chipState,
  pick,
  showConfidence,
  showAllProviders,
  setShowAllProviders,
  tRelease,
  genreQuery,
  setGenreQuery,
  visibleGenres,
  tGenre,
  keywordQuery,
  setKeywordQuery,
  shownKeywords,
  tKeyword,
  hiddenKeywordCount,
  setAllKeywords,
  allKeywords,
  matchingKeywords,
  favoriteCount,
  tvAn,
  setTvAn,
  platformZaehlung,
  genreListe,
  genreZaehlung,
}: {
  t: Translate
  setMode: Dispatch<SetStateAction<'include' | 'exclude'>>
  mode: 'include' | 'exclude'
  modusVon2: (feld: ModusFeld, anzahl: number) => { anzahl: number; wert: 'und' | 'oder'; setzen: (w: 'und' | 'oder') => void }
  filters: FilterState
  meta: DataMeta
  set: (patch: Partial<FilterState>) => void
  chipState: <K extends ListKey>(key: K, value: FilterState[K][number]) => { active: boolean; excluded: boolean }
  pick: <K extends ListKey>(key: K, value: FilterState[K][number]) => void
  showConfidence: boolean
  showAllProviders: boolean
  setShowAllProviders: Dispatch<SetStateAction<boolean>>
  tRelease: (type: ReleaseType, variant?: 'name' | 'short' | 'hint') => string
  genreQuery: string
  setGenreQuery: Dispatch<SetStateAction<string>>
  visibleGenres: string[]
  tGenre: (name: string) => string
  keywordQuery: string
  setKeywordQuery: Dispatch<SetStateAction<string>>
  shownKeywords: string[]
  tKeyword: (name: string) => string
  hiddenKeywordCount: number
  setAllKeywords: Dispatch<SetStateAction<boolean>>
  allKeywords: boolean
  matchingKeywords: string[]
  /** Zahl der gemerkten Titel — steht am Favoriten-Chip. */
  favoriteCount?: number
  /** Im Kalender: Schalter fürs Fernsehen und die Zahlen des Zeitraums. */
  tvAn?: boolean
  setTvAn?: (an: boolean) => void
  platformZaehlung?: Map<PlatformId, number>
  genreListe?: string[]
  genreZaehlung?: Map<string, number>
}) {
  const [mehr, setMehr] = useState(false)
  const plattformen: PlatformId[] = platformZaehlung
    ? [...platformZaehlung.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p)
    : meta.platforms
  const genres = genreListe ?? visibleGenres
  const mitZahl = (n: number | undefined) => (n ? <span className="opacity-60">{n}</span> : null)

  return (
    <>
      {/* Schnell-Schalter — Schalter (an/aus), nicht vom Klick-Modus betroffen. */}
      <div className="border-b border-ak-linie px-3 py-2.5">
        <Group label={t('filter.schnell')}>
          <Chip ton="gruen" active={filters.favoritesOnly} onClick={() => set({ favoritesOnly: !filters.favoritesOnly })}>
            ★ {t('filter.favourites')}
            {favoriteCount ? ` (${favoriteCount})` : ''}
          </Chip>
          <Chip ton="gruen" active={filters.kostenlosOnly} onClick={() => set({ kostenlosOnly: !filters.kostenlosOnly })}>
            {t('filter.kostenlos')}
          </Chip>
          <Chip ton="gruen" active={filters.confirmedOnly} onClick={() => set({ confirmedOnly: !filters.confirmedOnly })}>
            {t('filter.confirmedOnly')}
          </Chip>
          {setTvAn && (
            <Chip ton="gruen" active={Boolean(tvAn)} onClick={() => setTvAn(!tvAn)}>
              {t('filter.tvZeigen')}
            </Chip>
          )}
          {showConfidence && (
            <Chip ton="gruen" active={filters.availableOnly} onClick={() => set({ availableOnly: !filters.availableOnly })}>
              {t('filter.available')}
            </Chip>
          )}
        </Group>
      </div>

      {/* Klick-Modus in eigener Zeile, darunter der Kasten mit den betroffenen Filtern. */}
      <div className="p-3">
        <div className="rounded-2xl border border-ak-rand bg-ak-flaeche-2 p-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ak-leise">{t('filter.mode')}</span>
            <div className="inline-flex overflow-hidden rounded-lg border border-ak-rand">
              {(['include', 'exclude'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  className={[
                    'cursor-pointer px-3 py-1.5 text-xs font-bold transition',
                    mode === m
                      ? m === 'exclude'
                        ? 'bg-rose-500 text-white'
                        : 'bg-ak-flaeche text-ak-text'
                      : 'text-ak-leise hover:bg-ak-flaeche-2',
                  ].join(' ')}
                >
                  {m === 'exclude' ? `⊘ ${t('filter.modeExclude')}` : t('filter.modeInclude')}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-ak-rand bg-ak-flaeche p-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <Group label={t('filter.platform')} modus={modusVon2('platforms', filters.platforms.length)}>
                <MeineAnbieter
                  aktuell={filters.platforms}
                  verfuegbar={meta.platforms}
                  setzen={(platforms) => set({ platforms })}
                />
                {plattformen.map((p) => (
                  <Chip
                    ton="gruen"
                    key={p}
                    color={PLATFORMS[p].color}
                    {...chipState('platforms', p)}
                    onClick={() => pick('platforms', p)}
                  >
                    {PLATFORMS[p].name} {mitZahl(platformZaehlung?.get(p))}
                  </Chip>
                ))}
              </Group>

              <Group label={t('filter.genre')} modus={modusVon2('genres', filters.genres.length)}>
                <input
                  type="search"
                  value={genreQuery}
                  onChange={(e) => setGenreQuery(e.target.value)}
                  placeholder={t('filter.genreSearch')}
                  className="mb-1.5 w-full rounded-md border border-ak-rand bg-ak-flaeche-2 px-2 py-1 text-xs text-ak-text"
                />
                {genres.map((g) => (
                  <Chip ton="gruen" key={g} {...chipState('genres', g)} onClick={() => pick('genres', g)}>
                    {tGenre(g)} {mitZahl(genreZaehlung?.get(g))}
                  </Chip>
                ))}
              </Group>
            </div>

            <div className="mt-3 border-t border-dashed border-ak-linie pt-3">
              <button
                type="button"
                onClick={() => setMehr(!mehr)}
                aria-expanded={mehr}
                className="cursor-pointer text-[13px] font-bold text-ak-akzent-text hover:underline"
              >
                {mehr ? t('filter.weniger') : t('filter.mehr')}
              </button>
              {mehr && (
                <FilterMehr
                  t={t}
                  meta={meta}
                  filters={filters}
                  showConfidence={showConfidence}
                  modusVon2={modusVon2}
                  chipState={chipState}
                  pick={pick}
                  set={set}
                  tRelease={tRelease}
                  tKeyword={tKeyword}
                  showAllProviders={showAllProviders}
                  setShowAllProviders={setShowAllProviders}
                  keywordQuery={keywordQuery}
                  setKeywordQuery={setKeywordQuery}
                  shownKeywords={shownKeywords}
                  hiddenKeywordCount={hiddenKeywordCount}
                  setAllKeywords={setAllKeywords}
                  allKeywords={allKeywords}
                  matchingKeywords={matchingKeywords}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * **Die weiteren Filter** — erst hinter „mehr Filter". Sie gehören zum selben
 * Klick-Modus wie Anbieter und Genre darüber.
 */
type FilterMehrProps = {
  t: Translate
  meta: DataMeta
  filters: FilterState
  showConfidence: boolean
  modusVon2: (feld: ModusFeld, anzahl: number) => { anzahl: number; wert: 'und' | 'oder'; setzen: (w: 'und' | 'oder') => void }
  chipState: <K extends ListKey>(key: K, value: FilterState[K][number]) => { active: boolean; excluded: boolean }
  pick: <K extends ListKey>(key: K, value: FilterState[K][number]) => void
  set: (patch: Partial<FilterState>) => void
  tRelease: (type: ReleaseType, variant?: 'name' | 'short' | 'hint') => string
  tKeyword: (name: string) => string
  showAllProviders: boolean
  setShowAllProviders: Dispatch<SetStateAction<boolean>>
  keywordQuery: string
  setKeywordQuery: Dispatch<SetStateAction<string>>
  shownKeywords: string[]
  hiddenKeywordCount: number
  setAllKeywords: Dispatch<SetStateAction<boolean>>
  allKeywords: boolean
  matchingKeywords: string[]
}

function FilterMehr(props: FilterMehrProps) {
  const { t, meta, filters, modusVon2, chipState, pick, tRelease } = props
  return (
    <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Group label={t('filter.releaseType')} modus={modusVon2('releaseTypes', filters.releaseTypes.length)}>
        {(Object.keys(RELEASE_TYPES) as ReleaseType[]).map((type) => (
          <Chip ton="gruen" key={type} color={RELEASE_TYPES[type].color} title={tRelease(type, 'hint')} {...chipState('releaseTypes', type)} onClick={() => pick('releaseTypes', type)}>
            {tRelease(type)}
          </Chip>
        ))}
      </Group>

      <Group label={t('filter.status')}>
        {STATUS_OPTIONS.map((s) => (
          <Chip ton="gruen" key={s} {...chipState('statuses', s)} onClick={() => pick('statuses', s)}>
            {t(STATUS_LABEL_KEY[s])}
          </Chip>
        ))}
      </Group>

      <Group label={t('filter.fsk')}>
        {FSK_OPTIONS.map((f) => (
          <Chip ton="gruen" key={f} {...chipState('fsk', f)} onClick={() => pick('fsk', f)}>
            {t('filter.fskFrom', { n: f })}
          </Chip>
        ))}
      </Group>

      <Group label={t('filter.year')} modus={modusVon2('years', filters.years.length)}>
        {meta.years.map((y) => (
          <Chip ton="gruen" key={y} {...chipState('years', y)} onClick={() => pick('years', y)}>
            {y}
          </Chip>
        ))}
      </Group>

      <FilterMehrRest {...props} />
    </div>
  )
}

/** Bezugsquelle, Sicherheit und Keywords — der zweite Teil der „mehr Filter"-Fläche. */
function FilterMehrRest(props: FilterMehrProps) {
  const {
    t,
    meta,
    filters,
    showConfidence,
    modusVon2,
    chipState,
    pick,
    set,
    tKeyword,
    showAllProviders,
    setShowAllProviders,
    keywordQuery,
    setKeywordQuery,
    shownKeywords,
    hiddenKeywordCount,
    setAllKeywords,
    allKeywords,
    matchingKeywords,
  } = props
  return (
    <>
      {meta.providers.length > 0 && (
        <Group label={t('filter.provider', { count: meta.providers.length })} modus={modusVon2('providers', filters.providers.length)}>
          {meta.providers.slice(0, showAllProviders ? undefined : 12).map((name: string) => (
            <Chip ton="gruen" key={name} color="#34d399" {...chipState('providers', name)} onClick={() => pick('providers', name)}>
              {name}
            </Chip>
          ))}
          {meta.providers.length > 12 && (
            <button
              type="button"
              onClick={() => setShowAllProviders((v) => !v)}
              className="cursor-pointer text-xs text-ak-akzent-text underline-offset-2 hover:underline"
            >
              {showAllProviders ? t('filter.showLess') : t('filter.showMore', { count: meta.providers.length })}
            </button>
          )}
        </Group>
      )}

      {showConfidence && (
        <Group label={t('filter.confidence')}>
          {(['low', 'normal', 'high', 'very-high'] as const).map((c, i) => (
            <Chip ton="gruen" key={c} active={filters.minConfidence === c} onClick={() => set({ minConfidence: c })}>
              {i === 0 ? t('filter.source') : t('filter.sources', { n: i + 1 })}
            </Chip>
          ))}
        </Group>
      )}

      <div className="sm:col-span-2 xl:col-span-1">
        <Group label={t('filter.keywords', { count: meta.keywords.length })} modus={modusVon2('keywords', filters.keywords.length)}>
          <input
            type="search"
            value={keywordQuery}
            onChange={(e) => setKeywordQuery(e.target.value)}
            placeholder={t('filter.keywordSearch')}
            className="mb-1.5 w-full rounded-md border border-ak-rand bg-ak-flaeche-2 px-2 py-1 text-xs text-ak-text"
          />
          {shownKeywords.map((k) => (
            <Chip ton="gruen" key={k} {...chipState('keywords', k)} onClick={() => pick('keywords', k)}>
              {tKeyword(k)}
            </Chip>
          ))}
          {!keywordQuery && hiddenKeywordCount > 0 && (
            <Chip onClick={() => setAllKeywords((v) => !v)}>
              {allKeywords ? t('filter.showLess') : `(…) ${t('filter.showMore', { count: matchingKeywords.length })}`}
            </Chip>
          )}
        </Group>
      </div>
    </>
  )
}

/** `FilterDetails` mit eigenem Zustand — Suchfelder, Auswahlmodus und Aufklapper leben hier. */
export function FilterDetailsFeld({
  meta,
  filters,
  onChange,
  showConfidence,
  favoriteCount,
  tvAn,
  setTvAn,
  platformZaehlung,
  genreListe,
  genreZaehlung,
}: {
  meta: DataMeta
  filters: FilterState
  onChange: (next: FilterState) => void
  showConfidence: boolean
  favoriteCount?: number
  tvAn?: boolean
  setTvAn?: (an: boolean) => void
  platformZaehlung?: Map<PlatformId, number>
  genreListe?: string[]
  genreZaehlung?: Map<string, number>
}) {
  const werkzeug = useFilterWerkzeug(meta, filters, onChange)
  return (
    <FilterDetails
      {...werkzeug}
      filters={filters}
      meta={meta}
      showConfidence={showConfidence}
      favoriteCount={favoriteCount}
      tvAn={tvAn}
      setTvAn={setTvAn}
      platformZaehlung={platformZaehlung}
      genreListe={genreListe}
      genreZaehlung={genreZaehlung}
    />
  )
}

function useFilterWerkzeug(meta: DataMeta, filters: FilterState, onChange: (next: FilterState) => void) {
  const { t, tGenre, tKeyword, tRelease } = useLang()
  const [genreQuery, setGenreQuery] = useState('')
  const [keywordQuery, setKeywordQuery] = useState('')
  const [allKeywords, setAllKeywords] = useState(false)
  const [showAllProviders, setShowAllProviders] = useState(false)
  // Auswahlmodus: Ein Klick auf ein Tag wählt es — oder verbietet es.
  const [mode, setMode] = useState<'include' | 'exclude'>('include')
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch })
  const modusVon2 = (feld: ModusFeld, anzahl: number) => ({
    anzahl,
    wert: modusVon(filters, feld),
    setzen: (w: 'und' | 'oder') => set({ modus: { ...filters.modus, [feld]: w } }),
  })
  const pick = <K extends ListKey>(key: K, value: FilterState[K][number]) => onChange(toggleFilter(filters, key, value, mode))
  const chipState = <K extends ListKey>(key: K, value: FilterState[K][number]) => {
    const state = filterMode(filters, key, value)
    return { active: state === 'include', excluded: state === 'exclude' }
  }
  const sortedGenres = meta.genres.slice().sort((a, b) => tGenre(a).localeCompare(tGenre(b), 'de'))
  const visibleGenres = genreQuery ? sortedGenres.filter((g) => tGenre(g).toLowerCase().includes(genreQuery.toLowerCase())) : sortedGenres
  const sortedKeywords = meta.keywords.slice().sort((a, b) => tKeyword(a).localeCompare(tKeyword(b), 'de'))
  const matchingKeywords = keywordQuery ? sortedKeywords.filter((k) => tKeyword(k).toLowerCase().includes(keywordQuery.toLowerCase())) : sortedKeywords
  // Gewählte und ausgeschlossene Keywords bleiben immer sichtbar, sonst fände man ein Verbot nicht wieder.
  const setKeywords = [...filters.keywords, ...filters.excluded.keywords]
  const previewKeywords = [...setKeywords, ...matchingKeywords.filter((k) => !setKeywords.includes(k)).slice(0, KEYWORD_PREVIEW)]
  const shownKeywords = allKeywords || keywordQuery ? matchingKeywords : previewKeywords
  const hiddenKeywordCount = matchingKeywords.length - previewKeywords.length
  return {
    t, tGenre, tKeyword, tRelease, mode, setMode, modusVon2, set, pick, chipState, showAllProviders, setShowAllProviders,
    genreQuery, setGenreQuery, visibleGenres, keywordQuery, setKeywordQuery, shownKeywords, hiddenKeywordCount,
    allKeywords, setAllKeywords, matchingKeywords,
  }
}
