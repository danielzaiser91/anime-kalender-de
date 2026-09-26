import { useMemo } from 'react'
import type { ReleaseEvent } from '@shared/types.ts'
import type { Dataset } from '../lib/data.ts'
import { tvPremiere } from '../lib/tv-angabe.ts'
import { addDays, formatDate, startOfWeek, todayIso, weekdayName } from '@shared/time.ts'
import { useLang } from '../lib/i18n.tsx'
import { EventCard } from './EventCard.tsx'
import { useSprungZuHeute } from '../lib/woche-sprung.ts'

/** Trennt Termine mit belegter Uhrzeit von denen ohne — mit Uhrzeit zuerst. */
function splitByTime(events: ReleaseEvent[]): { timed: ReleaseEvent[]; untimed: ReleaseEvent[] } {
  const timed = events
    .filter((e) => e.time)
    .sort((a, b) => a.time!.localeCompare(b.time!))
  const untimed = events.filter((e) => !e.time).sort((a, b) => a.name.localeCompare(b.name, 'de'))
  return { timed, untimed }
}

/**
 * Zwei Farbfelder im heutigen Tag: Vorbei ist grau, was noch kommt bleibt blau.
 *
 * Der blaue Rahmen markiert den ganzen Tag — dadurch sah auch der Vormittag
 * noch so aus, als stünde er bevor. Die Grenze zwischen beiden Feldern sagt
 * jetzt ohne ein einziges Wort, wo die Gegenwart liegt.
 */
function TimeBand({ past, children }: { past?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={[
        '-mx-1 flex flex-col gap-1.5 rounded-lg px-1 py-1.5',
        past
          ? 'bg-slate-400/[0.14] opacity-70 dark:bg-black/25'
          : 'bg-sky-400/[0.10] dark:bg-sky-400/[0.08]',
      ].join(' ')}
    >
      {children}
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

  const { landingId, landingRef, now } = useSprungZuHeute({ days, today, monday })

  const card = (ev: ReleaseEvent) => {
    const inner = (
      <EventCard
        event={ev}
        title={data.titleById.get(ev.titleId)}
        fsk={data.releaseBySlug.get(ev.releaseSlug)?.fsk}
        premiere={tvPremiere(ev, data)}
        favorite={favorites.has(ev.titleId)}
        hidden={hidden.has(ev.titleId)}
        onToggleFavorite={ev.titleId > 0 ? () => onToggleFavorite(ev.titleId) : undefined}
        onToggleHidden={ev.titleId > 0 ? () => onToggleHidden(ev.titleId) : undefined}
        onOpen={() => onOpen(ev.releaseSlug, ev.date)}
      />
    )
    // Nur die Zielkarte bekommt eine Hülle — die braucht der Sprung als Anker.
    return ev.id === landingId ? (
      <div key={ev.id} ref={landingRef}>
        {inner}
      </div>
    ) : (
      <div key={ev.id}>{inner}</div>
    )
  }

  /**
   * Heute in Farbfeldern: erst das Vorbei-Feld, dann das Kommt-Feld.
   *
   * Auch wenn nur eine Hälfte existiert, bekommt sie ihr Feld — gerade dann
   * trägt die Farbe die ganze Aussage. Durchgehend grau heißt „für heute ist
   * Schluss", durchgehend blau „alles steht noch bevor". Ohne das sah ein
   * abgelaufener Tag genauso aus wie ein bevorstehender, und genau daran ist
   * die erste Fassung gescheitert.
   */
  const renderToday = (timed: ReleaseEvent[]) => {
    const past = timed.filter((e) => e.time! < now)
    const upcoming = timed.filter((e) => e.time! >= now)
    return (
      <>
        {past.length > 0 && <TimeBand past>{past.map(card)}</TimeBand>}
        {upcoming.length > 0 && <TimeBand>{upcoming.map(card)}</TimeBand>}
      </>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {days.map(({ date, timed, untimed }) => {
          const isToday = date === today
          const isPast = date < today
          return (
            <section
              key={date}
              data-heute={isToday ? '1' : undefined}
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
                    ? 'border-sky-400/40 text-sky-700 dark:text-sky-300'
                    : 'border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-400',
                ].join(' ')}
              >
                {/*
                  `h2` statt `span`: Der Tag ist die Überschrift seiner Spalte.
                  Am Aussehen ändert das nichts — Tailwind setzt Überschriften
                  auf `font-size: inherit` zurück, die Klassen bestimmen es
                  weiterhin allein. Es ändert, wer die Seite überhaupt
                  durchqueren kann: Die Kalenderansicht hatte am 20.08.2026
                  **keine einzige** Überschrift, also auch keinen Sprungpunkt
                  für jemanden, der sie vorgelesen bekommt.
                */}
                <h2 className="text-xs font-semibold uppercase tracking-wider">
                  {weekdayName(date, true)}
                  {isToday && <span className="ml-1 normal-case tracking-normal">· {t('week.today')}</span>}
                </h2>
                <span className="text-xs tabular-nums opacity-80">{formatDate(date).slice(0, 5)}</span>
              </header>

              <div className="flex flex-1 flex-col gap-1.5 p-2">
                {timed.length === 0 && untimed.length === 0 ? (
                  <p className="m-auto text-xs text-slate-400 dark:text-slate-600">{t('week.nothing')}</p>
                ) : (
                  <>
                    {/*
                      **Keine Überschriften mehr — die Kachel sagt es selbst.**

                      „MIT UHRZEIT" und „UHRZEIT OFFEN" standen in jeder Spalte, an
                      der die Woche beides trug: bei sieben Spalten bis zu
                      vierzehn Zeilen für eine Angabe, die an jeder Kachel schon
                      steht — als Uhrzeit oder als „im Handel". Seit dem
                      03.09.2026 trennt die Strichart der linken Linie
                      (durchgezogen / gepunktet), und die Legende erklärt sie
                      einmal für die ganze Seite statt vierzehnmal.

                      Die Reihenfolge bleibt: erst die mit Uhrzeit, chronologisch.
                    */}
                    {isToday ? renderToday(timed) : timed.map(card)}
                    {untimed.map(card)}
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
