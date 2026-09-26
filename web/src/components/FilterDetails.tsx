import { type PlatformId, PLATFORMS, RELEASE_TYPES, type ReleaseType, type DataMeta } from '@shared/types.ts'
import { Chip } from './ui.tsx'
import { type ModusFeld, type FilterState, type ListKey } from '../lib/filters.ts'
import type { Translate } from '../lib/i18n.tsx'
import type { Dispatch, SetStateAction } from 'react'
import { type Fsk, type ReleaseStatus } from '@shared/types.ts'
import { useLang } from '../lib/i18n.tsx'
import { useState } from 'react'

export const FSK_OPTIONS: Fsk[] = [0, 6, 12, 16, 18]

export const STATUS_OPTIONS: ReleaseStatus[] = ['airing', 'tba', 'abgeschlossen', 'erschienen', 'unbekannt']

export const KEYWORD_PREVIEW = 24

/**
 * **Der UND/ODER-Schalter einer Kategorie.**
 *
 * Er erscheint erst ab der zweiten gewählten Pill: Bei einer einzigen bewirkt er
 * nichts, und ein Schalter ohne Wirkung ist Rauschen an einer Stelle, an der
 * ohnehin viel steht.
 *
 * „egal" statt „ODER" — das trifft, was die Einstellung meint, und liest sich
 * ohne Nachdenken: Wer Netflix und Prime wählt, will „irgendwo davon" (egal
 * welches) oder „auf beiden" (alle).
 */
function ModusSchalter({
  wert,
  setzen,
}: {
  wert: 'und' | 'oder'
  setzen: (w: 'und' | 'oder') => void
}) {
  const knopf = (w: 'und' | 'oder', text: string, titel: string) => (
    <button
      type="button"
      onClick={() => setzen(w)}
      title={titel}
      aria-pressed={wert === w}
      className={
        'rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider transition ' +
        (wert === w
          ? 'bg-slate-600 text-slate-100'
          : 'text-slate-500 hover:text-slate-300')
      }
    >
      {text}
    </button>
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
  children: React.ReactNode
  /** Nur bei Kategorien, in denen ein Titel mehrere Werte tragen kann. */
  modus?: { anzahl: number; wert: 'und' | 'oder'; setzen: (w: 'und' | 'oder') => void }
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
        {modus && modus.anzahl > 1 ? <ModusSchalter wert={modus.wert} setzen={modus.setzen} /> : null}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

export const STATUS_LABEL_KEY = {
  airing: 'status.airing',
  abgeschlossen: 'status.abgeschlossen',
  tba: 'status.tba',
  erschienen: 'status.erschienen',
  unbekannt: 'status.unbekannt',
} as const

/**
 * **„Meine Anbieter" — die eigenen Abos als ein Klick** (18.09.2026, autonomer Modus).
 *
 * Aus dem Feature-Vergleich mit JustWatch („My Services"): Wer Netflix und Crunchyroll
 * hat, wählt beide bei jedem Besuch neu aus. Gespeichert wird im Browser, nicht in der
 * Adresse — eine Vorliebe ist keine Ansicht, und ein geteilter Link soll beim Empfänger
 * nicht still dessen Abos filtern. Deshalb auch kein automatisch gesetzter Filter: Der
 * Knopf zeigt an, dass es die Auswahl gibt, und setzt sie erst auf Klick.
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
    'cursor-pointer rounded-full border border-dashed border-slate-400/70 px-2.5 py-0.5 text-xs text-slate-600 transition hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-white/10'
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

export function FilterDetails({ t, setMode, mode, modusVon2, filters, meta, set, chipState, pick, showConfidence, showAllProviders, setShowAllProviders, tRelease, genreQuery, setGenreQuery, visibleGenres, tGenre, keywordQuery, setKeywordQuery, shownKeywords, tKeyword, hiddenKeywordCount, setAllKeywords, allKeywords, matchingKeywords }: {
  t: Translate
  setMode: Dispatch<SetStateAction<'include' | 'exclude'>>
  mode: 'include' | 'exclude'
  modusVon2: (feld: ModusFeld, anzahl: number) => { anzahl: number; wert: 'und' | 'oder'; setzen: (w: 'und' | 'oder') => void; }
  filters: FilterState
  meta: DataMeta
  set: (patch: Partial<FilterState>) => void
  chipState: <K extends ListKey>(key: K, value: FilterState[K][number]) => { active: boolean; excluded: boolean; }
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
}) {
  return (
    <>
      {/* Der Umschalter steht über den Tags, nicht neben jedem einzelnen:
          Wer etwas ausschließen will, will meist mehreres ausschließen. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-white/10">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {t('filter.mode')}
        </span>
        <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 dark:border-white/15">
          {(['include', 'exclude'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={[
                'cursor-pointer px-3 py-1 text-xs font-medium transition',
                mode === m
                  ? m === 'exclude'
                    ? 'bg-rose-500 text-white'
                    : 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-white/10',
              ].join(' ')}
            >
              {m === 'exclude' ? `⊘ ${t('filter.modeExclude')}` : t('filter.modeInclude')}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {t(mode === 'exclude' ? 'filter.modeExcludeHint' : 'filter.modeIncludeHint')}
        </span>
      </div>

      <div className="grid gap-4 p-3 sm:grid-cols-2 xl:grid-cols-3">
      <Group label={t('filter.platform')} modus={modusVon2('platforms', filters.platforms.length)}>
        <MeineAnbieter
          aktuell={filters.platforms}
          verfuegbar={meta.platforms}
          setzen={(platforms) => set({ platforms })}
        />
        {meta.platforms.map((p: PlatformId) => (
          <Chip
            key={p}
            color={PLATFORMS[p].color}
            {...chipState('platforms', p)}
            onClick={() => pick('platforms', p)}
          >
            {PLATFORMS[p].name}
          </Chip>
        ))}
      </Group>

      {/* Bezugsquellen nur in der Datenbank: In den Kalenderansichten geht es
          um Termine, und ein Termin liegt immer auf einer der bekannten
          Plattformen — dort wäre die Gruppe leer. */}
      {showConfidence && meta.providers.length > 0 && (
        <Group label={t('filter.provider', { count: meta.providers.length })} modus={modusVon2('providers', filters.providers.length)}>
          {meta.providers.slice(0, showAllProviders ? undefined : 12).map((name: string) => (
            <Chip
              key={name}
              color="#34d399"
              {...chipState('providers', name)}
              onClick={() => pick('providers', name)}
            >
              {name}
            </Chip>
          ))}
          {meta.providers.length > 12 && (
            <button
              type="button"
              onClick={() => setShowAllProviders((v) => !v)}
              className="cursor-pointer text-xs text-sky-700 dark:text-sky-300 underline-offset-2 hover:underline"
            >
              {showAllProviders
                ? t('filter.showLess')
                : t('filter.showMore', { count: meta.providers.length })}
            </button>
          )}
        </Group>
      )}

      <Group label={t('filter.releaseType')} modus={modusVon2('releaseTypes', filters.releaseTypes.length)}>
        {(Object.keys(RELEASE_TYPES) as ReleaseType[]).map((type) => (
          <Chip
            key={type}
            color={RELEASE_TYPES[type].color}
            title={tRelease(type, 'hint')}
            {...chipState('releaseTypes', type)}
            onClick={() => pick('releaseTypes', type)}
          >
            {tRelease(type)}
          </Chip>
        ))}
      </Group>

      <Group label={t('filter.status')}>
        {STATUS_OPTIONS.map((s) => (
          <Chip
            key={s}
            {...chipState('statuses', s)}
            onClick={() => pick('statuses', s)}
          >
            {t(STATUS_LABEL_KEY[s])}
          </Chip>
        ))}
      </Group>

      <Group label={t('filter.fsk')}>
        {FSK_OPTIONS.map((f) => (
          <Chip
            key={f}
            {...chipState('fsk', f)}
            onClick={() => pick('fsk', f)}
          >
            {t('filter.fskFrom', { n: f })}
          </Chip>
        ))}
      </Group>

      <Group label={t('filter.year')} modus={modusVon2('years', filters.years.length)}>
        {meta.years.map((y) => (
          <Chip
            key={y}
            {...chipState('years', y)}
            onClick={() => pick('years', y)}
          >
            {y}
          </Chip>
        ))}
      </Group>

      <Group label={t('filter.confidence')}>
        <Chip
          active={filters.confirmedOnly}
          onClick={() => set({ confirmedOnly: !filters.confirmedOnly })}
          title={t('filter.confirmedOnlyHint')}
        >
          {t('filter.confirmedOnly')}
        </Chip>
        {showConfidence &&
          (['low', 'normal', 'high', 'very-high'] as const).map((c, i) => (
            <Chip
              key={c}
              active={filters.minConfidence === c}
              onClick={() => set({ minConfidence: c })}
            >
              {i === 0 ? t('filter.source') : t('filter.sources', { n: i + 1 })}
            </Chip>
          ))}
      </Group>

      <div className="sm:col-span-2 xl:col-span-1">
        <Group label={t('filter.genre')} modus={modusVon2('genres', filters.genres.length)}>
          <input
            type="search"
            value={genreQuery}
            onChange={(e) => setGenreQuery(e.target.value)}
            placeholder={t('filter.genreSearch')}
            className="mb-1.5 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-white/15 dark:bg-white/5"
          />
          {visibleGenres.map((g) => (
            <Chip
              key={g}
              {...chipState('genres', g)}
              onClick={() => pick('genres', g)}
            >
              {tGenre(g)}
            </Chip>
          ))}
        </Group>
      </div>

      <div className="sm:col-span-2">
        <Group label={t('filter.keywords', { count: meta.keywords.length })} modus={modusVon2('keywords', filters.keywords.length)}>
          <input
            type="search"
            value={keywordQuery}
            onChange={(e) => setKeywordQuery(e.target.value)}
            placeholder={t('filter.keywordSearch')}
            className="mb-1.5 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-white/15 dark:bg-white/5"
          />
          {shownKeywords.map((k) => (
            <Chip
              key={k}
              {...chipState('keywords', k)}
              onClick={() => pick('keywords', k)}
            >
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
      </div>
    </>
  )
}
