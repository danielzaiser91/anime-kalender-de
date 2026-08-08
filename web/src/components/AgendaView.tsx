import { useMemo } from 'react'
import type { ReleaseEvent } from '@shared/types.ts'
import type { Dataset } from '../lib/data.ts'
import { formatDateLong, todayIso, weekdayName } from '@shared/time.ts'
import { useLang } from '../lib/i18n.tsx'
import { EventCard } from './EventCard.tsx'

export function AgendaView({
  data,
  events,
  anchorDate,
  favorites,
  hidden,
  onToggleFavorite,
  onToggleHidden,
  onOpen,
}: {
  data: Dataset
  events: ReleaseEvent[]
  anchorDate: string
  favorites: Set<number>
  hidden: Set<number>
  onToggleFavorite: (titleId: number) => void
  onToggleHidden: (titleId: number) => void
  onOpen: (slug: string, date: string) => void
}) {
  const { t } = useLang()
  const today = todayIso()

  const groups = useMemo(() => {
    const map = new Map<string, ReleaseEvent[]>()
    for (const ev of events) {
      if (ev.date < anchorDate) continue
      const list = map.get(ev.date)
      if (list) list.push(ev)
      else map.set(ev.date, [ev])
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, 60)
      .map(([date, list]) => ({
        date,
        // Termine mit Uhrzeit stehen vorn, danach die noch offenen.
        events: list.sort((a, b) => (a.time ?? '~').localeCompare(b.time ?? '~')),
      }))
  }, [events, anchorDate])

  if (groups.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">
        {t('agenda.empty')}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map(({ date, events: dayEvents }) => (
        <section key={date}>
          <h3 className="sticky top-0 z-10 mb-2 flex items-baseline gap-2 bg-[#f6f7fb]/90 py-1 backdrop-blur dark:bg-[#0a0e17]/90">
            <span
              className={[
                'text-sm font-semibold',
                date === today ? 'text-sky-500 dark:text-sky-300' : 'text-slate-800 dark:text-slate-100',
              ].join(' ')}
            >
              {weekdayName(date)}, {formatDateLong(date)}
            </span>
            {date === today && (
              <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-500">
                {t('week.today')}
              </span>
            )}
            <span className="ml-auto text-xs text-slate-400">{dayEvents.length}</span>
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {dayEvents.map((ev) => (
              <EventCard
                key={ev.id}
                event={ev}
                title={data.titleById.get(ev.titleId)}
                fsk={data.releaseBySlug.get(ev.releaseSlug)?.fsk}
                favorite={favorites.has(ev.titleId)}
                hidden={hidden.has(ev.titleId)}
                onToggleFavorite={ev.titleId > 0 ? () => onToggleFavorite(ev.titleId) : undefined}
                onToggleHidden={ev.titleId > 0 ? () => onToggleHidden(ev.titleId) : undefined}
                onOpen={() => onOpen(ev.releaseSlug, ev.date)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
