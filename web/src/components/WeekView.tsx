import { useMemo } from 'react'
import type { ReleaseEvent } from '@shared/types.ts'
import type { Dataset } from '../lib/data.ts'
import { istStaffelfinale, istStaffelstart } from '../lib/staffelstart.ts'
import { addDays, formatDate, startOfWeek, todayIso, weekdayName } from '@shared/time.ts'
import { useLang } from '../lib/i18n.tsx'
import { useSprungZuHeute } from '../lib/woche-sprung.ts'
import { useZielTag } from '../lib/ziel-tag.ts'
import { buendeleTermine } from '../lib/buendel.ts'
import { gesehenLesen } from '../lib/gesehen.ts'
import { PosterKarte, type KartenArt } from './kalender/PosterKarte.tsx'
import { TvKasten } from './kalender/TvKasten.tsx'

/** Ohne Uhrzeit hinter alles mit — ziffernbasiert, damit jede Kollation es hinten einsortiert. */
const OHNE_UHRZEIT = '99:99'

export interface Tag {
  date: string
  stream: ReleaseEvent[]
  tv: ReleaseEvent[]
  /** Für den Sprung zu heute: Streaming-Termine mit und ohne Uhrzeit. */
  timed: ReleaseEvent[]
  untimed: ReleaseEvent[]
}

function nachZeit(a: ReleaseEvent, b: ReleaseEvent): number {
  return (a.time ?? OHNE_UHRZEIT).localeCompare(b.time ?? OHNE_UHRZEIT) || a.name.localeCompare(b.name, 'de')
}

export function tageDerWoche(events: ReleaseEvent[], monday: string): Tag[] {
  const byDate = new Map<string, ReleaseEvent[]>()
  for (const ev of events) byDate.set(ev.date, [...(byDate.get(ev.date) ?? []), ev])
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i)
    const alle = (byDate.get(date) ?? []).slice().sort(nachZeit)
    const stream = alle.filter((e) => e.platform !== 'tv')
    return {
      date,
      stream,
      tv: alle.filter((e) => e.platform === 'tv'),
      timed: stream.filter((e) => e.time),
      untimed: stream.filter((e) => !e.time),
    }
  })
}

export interface WocheProps {
  data: Dataset
  events: ReleaseEvent[]
  anchorDate: string
  favorites: Set<number>
  hidden: Set<number>
  tvAn: boolean
  gefiltert: boolean
  onToggleFavorite: (titleId: number) => void
  onToggleHidden: (titleId: number) => void
  onOpen: (slug: string, date: string) => void
}

/**
 * Die Poster-Woche (26.09.2026): je Tag eine Zeile — links der Tag, in der Mitte die Streaming-
 * Termine als Cover, rechts das Fernsehen. Auf dem Handy stehen die Teile untereinander, genau zwei
 * Cover je Zeile.
 */
export function WeekView(p: WocheProps) {
  const { t } = useLang()
  const today = todayIso()
  const monday = startOfWeek(p.anchorDate)
  const days = useMemo(() => tageDerWoche(p.events, monday), [p.events, monday])
  const { landingId, landingRef, now } = useSprungZuHeute({ days, today, monday })
  useZielTag(days.map((d) => d.date))
  const total = days.reduce((s, d) => s + d.stream.length + d.tv.length, 0)

  return (
    <div className="flex flex-col">
      {days.map((tag) => (
        <TagZeile key={tag.date} tag={tag} p={p} today={today} now={now} landingId={landingId} landingRef={landingRef} />
      ))}
      {total === 0 && (
        <p className="rounded-2xl border border-dashed border-ak-rand p-8 text-center text-sm text-ak-leise">{t('week.empty')}</p>
      )}
    </div>
  )
}

function TagZeile({
  tag,
  p,
  today,
  now,
  landingId,
  landingRef,
}: {
  tag: Tag
  p: WocheProps
  today: string
  now: string
  landingId?: string
  landingRef: React.RefObject<HTMLDivElement | null>
}) {
  const { t } = useLang()
  const heute = tag.date === today
  const vorbei = tag.date < today
  /* Ausgeschaltet bleiben Premieren sichtbar (Daniel, 19.09.2026) — dann steht der Kasten nur für sie da. */
  const zeigeTv = p.tvAn || tag.tv.length > 0
  return (
    <section
      data-datum={tag.date}
      data-heute={heute ? '1' : undefined}
      aria-label={`${weekdayName(tag.date)}, ${formatDate(tag.date)}`}
      className={[
        'grid grid-cols-1 gap-x-6 gap-y-3 border-t border-ak-linie py-5 lg:py-6',
        zeigeTv ? 'lg:grid-cols-[110px_minmax(0,1fr)_300px]' : 'lg:grid-cols-[110px_minmax(0,1fr)]',
        vorbei ? 'opacity-[0.62] transition-opacity hover:opacity-100' : '',
      ].join(' ')}
    >
      <TagKopf tag={tag} heute={heute} tvAn={p.tvAn} />
      <PosterRaster tag={tag} p={p} heute={heute} now={now} landingId={landingId} landingRef={landingRef} />
      {zeigeTv && (
        <div className="relative lg:min-h-0">
          <div className="lg:absolute lg:inset-0 lg:overflow-y-auto lg:rounded-2xl">
            <TvKasten
              termine={tag.tv}
              data={p.data}
              hidden={p.hidden}
              vorbeiBis={heute ? now : vorbei ? '99:99' : undefined}
              onOpen={(ev) => p.onOpen(ev.releaseSlug, ev.date)}
            />
          </div>
        </div>
      )}
      {!p.tvAn && tag.stream.length === 0 && <span className="sr-only">{t('kal.keinStream')}</span>}
    </section>
  )
}

function TagKopf({ tag, heute, tvAn }: { tag: Tag; heute: boolean; tvAn: boolean }) {
  const { t } = useLang()
  const farbe = heute ? 'text-ak-akzent-text' : 'text-ak-text'
  return (
    <div className="flex items-baseline gap-3 lg:flex-col lg:items-start lg:gap-1">
      <h2 className={`text-[13px] font-bold uppercase tracking-[0.12em] ${farbe}`}>
        {weekdayName(tag.date, true)}
        {heute && <span> · {t('week.today')}</span>}
      </h2>
      <span className={`order-first font-display text-3xl leading-none font-bold lg:order-none lg:text-[44px] ${farbe}`}>
        {Number(tag.date.slice(8))}
      </span>
      <span className="ml-auto text-xs text-ak-leise lg:ml-0">
        {tvAn
          ? t('kal.tagZahlen', { stream: tag.stream.length, tv: tag.tv.length })
          : t('kal.tagZahlenOhneTv', { stream: tag.stream.length })}
      </span>
    </div>
  )
}

function PosterRaster({
  tag,
  p,
  heute,
  now,
  landingId,
  landingRef,
}: {
  tag: Tag
  p: WocheProps
  heute: boolean
  now: string
  landingId?: string
  landingRef: React.RefObject<HTMLDivElement | null>
}) {
  const { t } = useLang()
  const gesehen = gesehenLesen()
  const art = (ev: ReleaseEvent): KartenArt | undefined =>
    istStaffelstart(ev, p.data) ? 'start' : istStaffelfinale(ev, p.data) ? 'finale' : undefined
  const gruppen = buendeleTermine(tag.stream, (ev) => !!ev.verpasst || !!art(ev))
  return (
    <div className="grid grid-flow-dense grid-cols-2 content-start gap-x-3 gap-y-5 sm:grid-flow-row sm:grid-cols-[repeat(auto-fill,minmax(128px,1fr))] sm:gap-x-3.5 lg:min-h-[250px]">
      {tag.stream.length === 0 && (
        <p className="col-span-full pt-1 text-sm text-ak-sehr-leise">{t(p.gefiltert ? 'kal.nichtsGefiltert' : 'kal.keinStream')}</p>
      )}
      {gruppen.map(([ev, ...weitere]) => {
        const bis = p.favorites.has(ev.titleId) ? gesehen[ev.titleId] : undefined
        return (
          <PosterKarte
            key={ev.id}
            event={ev}
            title={p.data.titleById.get(ev.titleId)}
            art={art(ev)}
            weitere={weitere.length}
            favorite={p.favorites.has(ev.titleId)}
            hidden={p.hidden.has(ev.titleId)}
            vorbei={heute && !!ev.time && ev.time < now}
            neu={bis !== undefined && ev.episode ? Math.max(0, (weitere.at(-1)?.episode ?? ev.episode) - bis) : 0}
            anker={[ev, ...weitere].some((e) => e.id === landingId) ? (landingRef as React.Ref<HTMLElement>) : undefined}
            onToggleFavorite={ev.titleId > 0 ? () => p.onToggleFavorite(ev.titleId) : undefined}
            onToggleHidden={ev.titleId > 0 ? () => p.onToggleHidden(ev.titleId) : undefined}
            onOpen={() => p.onOpen(ev.releaseSlug, ev.date)}
          />
        )
      })}
    </div>
  )
}
