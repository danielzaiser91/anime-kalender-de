import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReleaseEvent } from '@shared/types.ts'
import type { Dataset } from '../lib/data.ts'
import { addDays, formatDate, nowHhMm, startOfWeek, todayIso, weekdayName } from '@shared/time.ts'
import { useLang } from '../lib/i18n.tsx'
import { EventCard } from './EventCard.tsx'

/**
 * Unterhalb dieser Breite steht ein Tag als einzelne senkrechte Spalte —
 * dieselbe Grenze wie Tailwinds `sm:`. Nur dort ist der Sprung sinnvoll:
 * Auf breiten Schirmen liegen die sieben Tage nebeneinander und man sieht
 * ohnehin alles.
 */
const SINGLE_COLUMN = '(max-width: 639px)'

/**
 * Wie viel vom Vorherigen über der nächsten Folge sichtbar bleibt. Ohne diesen
 * Rest sähe die Seite aus, als begänne der Tag hier — der Vorlauf verrät, dass
 * oben noch etwas ist.
 */
const LEAD_PX = 30

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

  // Die aktuelle Uhrzeit trennt im heutigen Tag Vergangenes von Kommendem.
  // Einmal je Minute nachziehen, damit die Grenze nicht stehen bleibt.
  const [now, setNow] = useState(nowHhMm)
  useEffect(() => {
    const id = window.setInterval(() => setNow(nowHhMm()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  /**
   * Der Termin von heute, bei dem der Blick landen soll: der nächste, der noch
   * aussteht. Ist der Tag schon durch, wird es der letzte — dann steht der
   * jüngste Eintrag oben statt der Vormittag von vor zehn Stunden.
   */
  const landingId = useMemo(() => {
    const day = days.find((d) => d.date === today)
    if (!day?.timed.length) return undefined
    return (day.timed.find((e) => e.time! >= now) ?? day.timed[day.timed.length - 1]).id
  }, [days, today, now])

  const landingRef = useRef<HTMLDivElement | null>(null)
  /** Für welche Woche schon gesprungen wurde — verhindert erneutes Springen. */
  const jumpedFor = useRef<string | undefined>(undefined)

  useEffect(() => {
    const showsToday = days.some((d) => d.date === today)
    if (!showsToday || !landingId) return
    // Einmal je Ankunft. Wer innerhalb der Woche filtert, blättert oder eine
    // Karte öffnet, soll nicht wieder nach unten gerissen werden.
    if (jumpedFor.current === monday) return
    if (!window.matchMedia(SINGLE_COLUMN).matches) return

    const el = landingRef.current
    if (!el) return
    jumpedFor.current = monday

    const jump = () => {
      // Die Kopfleiste klebt oben und würde die Karte sonst verdecken.
      const header = document.querySelector('header')
      const offset = (header?.getBoundingClientRect().height ?? 0) + LEAD_PX
      window.scrollTo({
        top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - offset),
        // Wer Bewegung abgestellt hat, bekommt keine — und im versteckten Tab
        // liefe eine weiche Bewegung ohnehin nicht.
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      })
    }

    // Im Hintergrund geöffnet? Dann läuft die weiche Bewegung nicht, und der
    // Sprung ginge lautlos verloren — die Seite stünde beim Hinschauen oben.
    // Also warten, bis wirklich jemand hinsieht.
    if (document.hidden) {
      const onVisible = () => {
        if (document.hidden) return
        document.removeEventListener('visibilitychange', onVisible)
        jump()
      }
      document.addEventListener('visibilitychange', onVisible)
      return () => document.removeEventListener('visibilitychange', onVisible)
    }
    jump()
  }, [days, monday, today, landingId])

  // Verlässt man die Woche mit heute, darf beim nächsten Besuch wieder
  // gesprungen werden.
  useEffect(() => {
    if (!days.some((d) => d.date === today)) jumpedFor.current = undefined
  }, [days, today])

  const card = (ev: ReleaseEvent) => {
    const inner = (
      <EventCard
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
                        {isToday ? renderToday(timed) : timed.map(card)}
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
