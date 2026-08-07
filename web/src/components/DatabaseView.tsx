import { useMemo, useState } from 'react'
import type { Title } from '@shared/types.ts'
import { titleStatus } from '@shared/logic.ts'
import { todayIso } from '@shared/time.ts'
import type { Dataset } from '../lib/data.ts'
import { FskBadge, PlatformBadge, StatusBadge } from './ui.tsx'

const PAGE_SIZE = 60

export function DatabaseView({
  data,
  titles,
  onOpenTitle,
}: {
  data: Dataset
  titles: Title[]
  onOpenTitle: (id: number) => void
}) {
  const today = todayIso()
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [sort, setSort] = useState<'titel' | 'jahr' | 'score'>('titel')

  const sorted = useMemo(() => {
    const list = titles.slice()
    if (sort === 'titel') {
      list.sort((a, b) =>
        (a.titleDe ?? a.titleEn ?? a.titleRomaji ?? '').localeCompare(
          b.titleDe ?? b.titleEn ?? b.titleRomaji ?? '',
          'de',
        ),
      )
    } else if (sort === 'jahr') {
      list.sort((a, b) => (b.jpYear ?? 0) - (a.jpYear ?? 0))
    } else {
      list.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    }
    return list
  }, [titles, sort])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
        <span>
          <strong className="text-slate-800 dark:text-slate-100">{titles.length}</strong> Anime mit
          belegter deutscher Synchro
        </span>
        <label className="ml-auto flex items-center gap-2">
          Sortierung
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-white/15 dark:bg-white/5"
          >
            <option value="titel">Titel A–Z</option>
            <option value="jahr">Jahr (neu zuerst)</option>
            <option value="score">Bewertung</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {sorted.slice(0, visible).map((t) => {
          const releases = data.releasesByTitle.get(t.id) ?? []
          const status = titleStatus(releases, today)
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onOpenTitle(t.id)}
              className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:border-slate-300 hover:shadow-lg dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <div className="relative aspect-[2/3] overflow-hidden bg-slate-200 dark:bg-white/5">
                {t.coverImage && (
                  <img
                    src={t.coverImage}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                )}
                {t.fsk !== undefined && (
                  <span className="absolute right-1 top-1">
                    <FskBadge fsk={t.fsk} small />
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-2">
                <span className="line-clamp-2 text-[13px] font-medium leading-snug text-slate-900 dark:text-slate-100">
                  {t.titleDe ?? t.titleEn ?? t.titleRomaji}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t.jpYear ?? '—'}
                  {t.episodes ? ` · ${t.episodes} Ep.` : ''}
                </span>
                <span className="mt-auto flex flex-wrap items-center gap-1">
                  <StatusBadge status={status} small />
                  {(releases[0]?.platform ?? t.streams[0]?.platform) && (
                    <PlatformBadge
                      platform={releases[0]?.platform ?? t.streams[0].platform}
                      small
                    />
                  )}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {visible < sorted.length && (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE_SIZE * 2)}
          className="mx-auto rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200/60 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/10"
        >
          Weitere {Math.min(PAGE_SIZE * 2, sorted.length - visible)} anzeigen
          <span className="ml-2 text-xs opacity-60">({sorted.length - visible} übrig)</span>
        </button>
      )}
    </div>
  )
}
