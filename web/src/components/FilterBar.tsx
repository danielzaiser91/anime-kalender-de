import { useState } from 'react'
import type { DataMeta, Fsk, PlatformId, ReleaseStatus, ReleaseType } from '@shared/types.ts'
import { PLATFORMS, RELEASE_TYPES, STATUS_LABEL } from '@shared/types.ts'
import { EMPTY_FILTERS, activeFilterCount, toggleValue, type FilterState } from '../lib/filters.ts'
import { Chip } from './ui.tsx'

const FSK_OPTIONS: Fsk[] = [0, 6, 12, 16, 18]
const STATUS_OPTIONS: ReleaseStatus[] = ['airing', 'abgeschlossen', 'tba', 'unbekannt']

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

export function FilterBar({
  meta,
  filters,
  onChange,
  showConfidence,
}: {
  meta: DataMeta
  filters: FilterState
  onChange: (next: FilterState) => void
  showConfidence: boolean
}) {
  const [open, setOpen] = useState(false)
  const [genreQuery, setGenreQuery] = useState('')
  const [keywordQuery, setKeywordQuery] = useState('')
  const count = activeFilterCount(filters)

  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch })

  const visibleKeywords = keywordQuery
    ? meta.keywords.filter((k) => k.toLowerCase().includes(keywordQuery.toLowerCase())).slice(0, 40)
    : [...filters.keywords, ...meta.keywords.filter((k) => !filters.keywords.includes(k)).slice(0, 24)]

  const visibleGenres = genreQuery
    ? meta.genres.filter((g) => g.toLowerCase().includes(genreQuery.toLowerCase()))
    : meta.genres

  return (
    <div className="rounded-xl border border-slate-200 bg-white/70 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex flex-wrap items-center gap-2 p-2">
        <div className="relative min-w-52 flex-1">
          <input
            type="search"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            placeholder="Titel, Studio, Genre, Keyword …"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-sky-400 focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-slate-100"
          />
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200/60 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
        >
          Filter
          {count > 0 && (
            <span className="rounded-full bg-sky-500 px-1.5 text-[11px] font-bold text-white">
              {count}
            </span>
          )}
          <span aria-hidden="true" className={open ? 'rotate-180 transition' : 'transition'}>
            ▾
          </span>
        </button>

        {count > 0 && (
          <button
            type="button"
            onClick={() => onChange({ ...EMPTY_FILTERS })}
            className="rounded-lg px-2.5 py-2 text-sm text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
          >
            zurücksetzen
          </button>
        )}
      </div>

      {open && (
        <div className="animate-fade-in grid gap-4 border-t border-slate-200 p-3 dark:border-white/10 sm:grid-cols-2 xl:grid-cols-3">
          <Group label="Plattform">
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

          <Group label="Release-Art">
            {(Object.keys(RELEASE_TYPES) as ReleaseType[]).map((t) => (
              <Chip
                key={t}
                color={RELEASE_TYPES[t].color}
                title={RELEASE_TYPES[t].hint}
                active={filters.releaseTypes.includes(t)}
                onClick={() => set({ releaseTypes: toggleValue(filters.releaseTypes, t) })}
              >
                {RELEASE_TYPES[t].name}
              </Chip>
            ))}
          </Group>

          <Group label="Status">
            {STATUS_OPTIONS.map((s) => (
              <Chip
                key={s}
                active={filters.statuses.includes(s)}
                onClick={() => set({ statuses: toggleValue(filters.statuses, s) })}
              >
                {STATUS_LABEL[s]}
              </Chip>
            ))}
          </Group>

          <Group label="FSK">
            {FSK_OPTIONS.map((f) => (
              <Chip
                key={f}
                active={filters.fsk.includes(f)}
                onClick={() => set({ fsk: toggleValue(filters.fsk, f) })}
              >
                ab {f}
              </Chip>
            ))}
          </Group>

          <Group label="Jahr">
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

          <Group label="Sicherheit der Angaben">
            <Chip
              active={filters.confirmedOnly}
              onClick={() => set({ confirmedOnly: !filters.confirmedOnly })}
              title="Blendet Termine aus, die nur aus dem Simulcast-Start abgeleitet sind"
            >
              nur bestätigte Termine
            </Chip>
            {showConfidence &&
              (['low', 'normal', 'high', 'very-high'] as const).map((c) => (
                <Chip
                  key={c}
                  active={filters.minConfidence === c}
                  onClick={() => set({ minConfidence: c })}
                  title="Wie viele unabhängige Quellen belegen die deutsche Synchro"
                >
                  {c === 'low' ? '≥1 Quelle' : c === 'normal' ? '≥2 Quellen' : c === 'high' ? '≥3 Quellen' : '≥4 Quellen'}
                </Chip>
              ))}
          </Group>

          <div className="sm:col-span-2 xl:col-span-1">
            <Group label="Genre">
              <input
                type="search"
                value={genreQuery}
                onChange={(e) => setGenreQuery(e.target.value)}
                placeholder="Genre suchen"
                className="mb-1.5 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-white/15 dark:bg-white/5"
              />
              {visibleGenres.map((g) => (
                <Chip
                  key={g}
                  active={filters.genres.includes(g)}
                  onClick={() => set({ genres: toggleValue(filters.genres, g) })}
                >
                  {g}
                </Chip>
              ))}
            </Group>
          </div>

          <div className="sm:col-span-2">
            <Group label={`Keywords (${meta.keywords.length} verfügbar)`}>
              <input
                type="search"
                value={keywordQuery}
                onChange={(e) => setKeywordQuery(e.target.value)}
                placeholder="z. B. Weibliche Protagonistin, Isekai, Zeitschleife …"
                className="mb-1.5 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-white/15 dark:bg-white/5"
              />
              {visibleKeywords.map((k) => (
                <Chip
                  key={k}
                  active={filters.keywords.includes(k)}
                  onClick={() => set({ keywords: toggleValue(filters.keywords, k) })}
                >
                  {k}
                </Chip>
              ))}
            </Group>
          </div>
        </div>
      )}
    </div>
  )
}
