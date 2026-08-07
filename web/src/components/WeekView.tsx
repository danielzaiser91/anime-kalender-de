import { useMemo } from 'react'
import type { ReleaseEvent } from '@shared/types.ts'
import type { Dataset } from '../lib/data.ts'
import { addDays, formatDate, startOfWeek, todayIso, weekdayName } from '@shared/time.ts'
import { EventCard } from './EventCard.tsx'

export function WeekView({
  data,
  events,
  anchorDate,
  onOpen,
}: {
  data: Dataset
  events: ReleaseEvent[]
  anchorDate: string
  onOpen: (slug: string, date: string) => void
}) {
  const today = todayIso()
  const monday = startOfWeek(anchorDate)

  const days = useMemo(() => {
    const byDate = new Map<string, ReleaseEvent[]>()
    for (const ev of events) {
      const list = byDate.get(ev.date)
      if (list) list.push(ev)
      else byDate.set(ev.date, [ev])
    }
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i)
      const list = (byDate.get(date) ?? []).slice().sort((a, b) => {
        if (!a.time && !b.time) return a.name.localeCompare(b.name, 'de')
        if (!a.time) return 1
        if (!b.time) return -1
        return a.time.localeCompare(b.time)
      })
      return { date, events: list }
    })
  }, [events, monday])

  const total = days.reduce((sum, d) => sum + d.events.length, 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {days.map(({ date, events: dayEvents }) => {
          const isToday = date === today
          const isPast = date < today
          return (
            <section
              key={date}
              aria-label={`${weekdayName(date)}, ${formatDate(date)}`}
              className={[
                'flex min-h-40 flex-col rounded-xl border transition',
                isToday
                  ? 'border-sky-400/70 bg-sky-400/[0.06] shadow-[0_0_0_1px_rgba(56,189,248,.25)]'
                  : 'border-slate-200 bg-white/70 dark:border-white/10 dark:bg-white/[0.02]',
                isPast && !isToday ? 'opacity-60' : '',
              ].join(' ')}
            >
              <header
                className={[
                  'flex items-baseline justify-between gap-2 border-b px-3 py-2',
                  isToday
                    ? 'border-sky-400/40 text-sky-500 dark:text-sky-300'
                    : 'border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-400',
                ].join(' ')}
              >
                <span className="text-xs font-semibold uppercase tracking-wider">
                  {weekdayName(date, true)}
                  {isToday && <span className="ml-1 normal-case tracking-normal">· heute</span>}
                </span>
                <span className="text-xs tabular-nums opacity-80">{formatDate(date).slice(0, 5)}</span>
              </header>

              <div className="flex flex-1 flex-col gap-1.5 p-2">
                {dayEvents.length === 0 ? (
                  <p className="m-auto text-xs text-slate-400 dark:text-slate-600">nichts</p>
                ) : (
                  dayEvents.map((ev) => (
                    <EventCard
                      key={ev.id}
                      event={ev}
                      title={data.titleById.get(ev.titleId)}
                      fsk={data.releaseBySlug.get(ev.releaseSlug)?.fsk}
                      onOpen={() => onOpen(ev.releaseSlug, ev.date)}
                    />
                  ))
                )}
              </div>
            </section>
          )
        })}
      </div>

      {total === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">
          In dieser Woche liegt kein Termin, der zu den Filtern passt. Mit den Pfeiltasten ← → springst
          du durch die Wochen.
        </p>
      )}
    </div>
  )
}
