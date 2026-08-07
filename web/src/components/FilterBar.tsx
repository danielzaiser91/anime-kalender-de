import { useState } from 'react'
import type { DataMeta, Fsk, PlatformId, ReleaseStatus, ReleaseType } from '@shared/types.ts'
import { PLATFORMS, RELEASE_TYPES } from '@shared/types.ts'
import { EMPTY_FILTERS, activeFilterCount, toggleValue, type FilterState } from '../lib/filters.ts'
import { useLang } from '../lib/i18n.tsx'
import { Chip } from './ui.tsx'

const FSK_OPTIONS: Fsk[] = [0, 6, 12, 16, 18]
const STATUS_OPTIONS: ReleaseStatus[] = ['airing', 'tba', 'abgeschlossen', 'erschienen', 'unbekannt']
const KEYWORD_PREVIEW = 24

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

const STATUS_LABEL_KEY = {
  airing: 'status.airing',
  abgeschlossen: 'status.abgeschlossen',
  tba: 'status.tba',
  erschienen: 'status.erschienen',
  unbekannt: 'status.unbekannt',
} as const

export function FilterBar({
  meta,
  filters,
  onChange,
  showConfidence,
  favoriteCount,
}: {
  meta: DataMeta
  filters: FilterState
  onChange: (next: FilterState) => void
  showConfidence: boolean
  favoriteCount: number
}) {
  const { t, tGenre, tKeyword, tRelease } = useLang()
  const [open, setOpen] = useState(false)
  const [genreQuery, setGenreQuery] = useState('')
  const [keywordQuery, setKeywordQuery] = useState('')
  const [allKeywords, setAllKeywords] = useState(false)
  const count = activeFilterCount(filters)

  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch })

  const sortedGenres = meta.genres
    .slice()
    .sort((a, b) => tGenre(a).localeCompare(tGenre(b), 'de'))
  const visibleGenres = genreQuery
    ? sortedGenres.filter((g) => tGenre(g).toLowerCase().includes(genreQuery.toLowerCase()))
    : sortedGenres

  const sortedKeywords = meta.keywords
    .slice()
    .sort((a, b) => tKeyword(a).localeCompare(tKeyword(b), 'de'))
  const matchingKeywords = keywordQuery
    ? sortedKeywords.filter((k) => tKeyword(k).toLowerCase().includes(keywordQuery.toLowerCase()))
    : sortedKeywords
  // Gewählte Keywords bleiben immer sichtbar, damit sie abwählbar sind.
  const previewKeywords = [
    ...filters.keywords,
    ...matchingKeywords.filter((k) => !filters.keywords.includes(k)).slice(0, KEYWORD_PREVIEW),
  ]
  const shownKeywords = allKeywords || keywordQuery ? matchingKeywords : previewKeywords
  const hiddenKeywordCount = matchingKeywords.length - previewKeywords.length

  return (
    <div className="rounded-xl border border-slate-200 bg-white/70 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex flex-wrap items-center gap-2 p-2">
        <div className="relative min-w-52 flex-1">
          <input
            type="search"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            placeholder={t('filter.search')}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-sky-400 focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-slate-100"
          />
        </div>

        <Chip
          active={filters.favoritesOnly}
          onClick={() => set({ favoritesOnly: !filters.favoritesOnly })}
          color="#fbbf24"
        >
          ★ {t('filter.favourites')}
          {favoriteCount > 0 && <span className="opacity-60">({favoriteCount})</span>}
        </Chip>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
        >
          {t('filter.button')}
          {count > 0 && (
            <span className="rounded-full bg-sky-500 px-1.5 text-[11px] font-bold text-white">{count}</span>
          )}
          <span aria-hidden="true" className={open ? 'rotate-180 transition' : 'transition'}>
            ▾
          </span>
        </button>

        {count > 0 && (
          <button
            type="button"
            onClick={() => onChange({ ...EMPTY_FILTERS })}
            className="cursor-pointer rounded-lg px-2.5 py-2 text-sm text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
          >
            {t('filter.reset')}
          </button>
        )}
      </div>

      {open && (
        <div className="animate-fade-in grid gap-4 border-t border-slate-200 p-3 dark:border-white/10 sm:grid-cols-2 xl:grid-cols-3">
          <Group label={t('filter.platform')}>
            {meta.platforms.map((p: PlatformId) => (
              <Chip
                key={p}
                color={PLATFORMS[p].color}
                active={filters.platforms.includes(p)}
                onClick={() => set({ platforms: toggleValue(filters.platforms, p) })}
              >
                {PLATFORMS[p].name}
              </Chip>
            ))}
          </Group>

          <Group label={t('filter.releaseType')}>
            {(Object.keys(RELEASE_TYPES) as ReleaseType[]).map((type) => (
              <Chip
                key={type}
                color={RELEASE_TYPES[type].color}
                title={tRelease(type, 'hint')}
                active={filters.releaseTypes.includes(type)}
                onClick={() => set({ releaseTypes: toggleValue(filters.releaseTypes, type) })}
              >
                {tRelease(type)}
              </Chip>
            ))}
          </Group>

          <Group label={t('filter.status')}>
            {STATUS_OPTIONS.map((s) => (
              <Chip
                key={s}
                active={filters.statuses.includes(s)}
                onClick={() => set({ statuses: toggleValue(filters.statuses, s) })}
              >
                {t(STATUS_LABEL_KEY[s])}
              </Chip>
            ))}
          </Group>

          <Group label={t('filter.fsk')}>
            {FSK_OPTIONS.map((f) => (
              <Chip
                key={f}
                active={filters.fsk.includes(f)}
                onClick={() => set({ fsk: toggleValue(filters.fsk, f) })}
              >
                {t('filter.fskFrom', { n: f })}
              </Chip>
            ))}
          </Group>

          <Group label={t('filter.year')}>
            {meta.years.map((y) => (
              <Chip
                key={y}
                active={filters.years.includes(y)}
                onClick={() => set({ years: toggleValue(filters.years, y) })}
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
            <Group label={t('filter.genre')}>
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
                  active={filters.genres.includes(g)}
                  onClick={() => set({ genres: toggleValue(filters.genres, g) })}
                >
                  {tGenre(g)}
                </Chip>
              ))}
            </Group>
          </div>

          <div className="sm:col-span-2">
            <Group label={t('filter.keywords', { count: meta.keywords.length })}>
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
                  active={filters.keywords.includes(k)}
                  onClick={() => set({ keywords: toggleValue(filters.keywords, k) })}
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
      )}
    </div>
  )
}
