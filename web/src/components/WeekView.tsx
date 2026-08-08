import { useMemo } from 'react'
import type { ReleaseEvent } from '@shared/types.ts'
import type { Dataset } from '../lib/data.ts'
import { addDays, formatDate, startOfWeek, todayIso, weekdayName } from '@shared/time.ts'
import { useLang } from '../lib/i18n.tsx'
import { EventCard } from './EventCard.tsx'

/** Trennt Termine mit belegter Uhrzeit von denen ohne — mit Uhrzeit zuerst. */
function splitByTime(events: ReleaseEvent[]): { timed: ReleaseEvent[]; untimed: ReleaseEvent[] } {
  const timed = events
    .filter((e) => e.time)
    .sort((a, b) => a.time!.localeCompare(b.time!))
  const untimed = events.filter((e) => !e.time).sort((a, b) => a.name.localeCompare(b.name, 'de'))
  return { timed, untimed }
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-0.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
      <span className="whitespace-nowrap">{children}</span>
      <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
    </div>
  )
}

export function WeekView({
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
      return { date, ...splitByTime(byDate.get(date) ?? []) }
    })
  }, [events, monday])

  const total = days.reduce((sum, d) => sum + d.timed.length + d.untimed.length, 0)

  const card = (ev: ReleaseEvent) => (
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
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {days.map(({ date, timed, untimed }) => {
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
                  {isToday && <span className="ml-1 normal-case tracking-normal">· {t('week.today')}</span>}
                </span>
                <span className="text-xs tabular-nums opacity-80">{formatDate(date).slice(0, 5)}</span>
              </header>

              <div className="flex flex-1 flex-col gap-1.5 p-2">
                {timed.length === 0 && untimed.length === 0 ? (
                  <p className="m-auto text-xs text-slate-400 dark:text-slate-600">{t('week.nothing')}</p>
                ) : (
                  <>
                    {timed.length > 0 && (
                      <>
                        {untimed.length > 0 && <GroupLabel>{t('week.withTime')}</GroupLabel>}
                        {timed.map(card)}
                      </>
                    )}
                    {untimed.length > 0 && (
                      <>
                        {timed.length > 0 && <GroupLabel>{t('week.withoutTime')}</GroupLabel>}
                        {untimed.map(card)}
                      </>
                    )}
                  </>
                )}
              </div>
            </section>
          )
        })}
      </div>

      {total === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-white/15 dark:text-slate-400">
          {t('week.empty')}
        </p>
      )}
    </div>
  )
}
