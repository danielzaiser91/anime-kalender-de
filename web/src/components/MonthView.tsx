import { useMemo } from 'react'
import type { ReleaseEvent } from '@shared/types.ts'
import { RELEASE_TYPES } from '@shared/types.ts'
import { addDays, startOfMonth, startOfWeek, todayIso, weekdayName } from '@shared/time.ts'

export function MonthView({
  events,
  anchorDate,
  onOpen,
  onPickDay,
}: {
  events: ReleaseEvent[]
  anchorDate: string
  onOpen: (slug: string, date: string) => void
  onPickDay: (date: string) => void
}) {
  const today = todayIso()
  const month = anchorDate.slice(0, 7)
  const gridStart = startOfWeek(startOfMonth(anchorDate))

  const byDate = useMemo(() => {
    const map = new Map<string, ReleaseEvent[]>()
    for (const ev of events) {
      const list = map.get(ev.date)
      if (list) list.push(ev)
      else map.set(ev.date, [ev])
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'))
    }
    return map
  }, [events])

  // Sechs Wochen decken jeden Monat ab, ohne dass die Höhe springt.
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-100/60 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="py-1.5">
            {weekdayName(addDays(gridStart, i), true)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((date) => {
          const dayEvents = byDate.get(date) ?? []
          const inMonth = date.slice(0, 7) === month
          const isToday = date === today
          return (
            <div
              key={date}
              className={[
                'min-h-24 border-t border-l border-slate-200 p-1 first:border-l-0 dark:border-white/10',
                inMonth ? '' : 'bg-slate-50/60 opacity-50 dark:bg-black/20',
                isToday ? 'bg-sky-400/10' : '',
              ].join(' ')}
            >
              <button
                type="button"
                onClick={() => onPickDay(date)}
                title="Woche dieses Tages öffnen"
                className={[
                  'mb-1 flex h-5 w-5 items-center justify-center rounded text-[11px] tabular-nums transition',
                  isToday
                    ? 'bg-sky-500 font-bold text-white'
                    : 'text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-white/10',
                ].join(' ')}
              >
                {Number(date.slice(8))}
              </button>

              <div className="flex flex-col gap-0.5">
                {dayEvents.slice(0, 4).map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => onOpen(ev.releaseSlug, ev.date)}
                    className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] text-slate-700 transition hover:bg-slate-200/70 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ background: RELEASE_TYPES[ev.releaseType].color }}
                    />
                    {ev.time && <span className="tabular-nums opacity-70">{ev.time}</span>}
                    <span className="truncate">{ev.name}</span>
                  </button>
                ))}
                {dayEvents.length > 4 && (
                  <button
                    type="button"
                    onClick={() => onPickDay(date)}
                    className="px-1 text-left text-[11px] text-sky-500 hover:underline"
                  >
                    +{dayEvents.length - 4} weitere
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
