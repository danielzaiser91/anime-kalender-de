import { useMemo } from 'react'
import type { ReleaseEvent } from '@shared/types.ts'
import type { Dataset } from '../lib/data.ts'
import { istStaffelstart } from '../lib/staffelstart.ts'
import { addDays, formatDate, nowHhMm, startOfWeek, todayIso, weekdayName } from '@shared/time.ts'
import { fruehesteKommende, kachelAngabe } from '@shared/laeuft-jetzt.ts'
import { useLang } from '../lib/i18n.tsx'
import { useSprungZuHeute } from '../lib/woche-sprung.ts'
import { useZielTag } from '../lib/ziel-tag.ts'
import { buendeleKacheln } from '../lib/buendel.ts'
import { kartenArt } from '../lib/kachel-folgen.ts'
import { eigenstaendigBeiAnbietern, kanalAnbieterVon, vereineAnbieter } from '../lib/anbieter-kachel.ts'
import { gesehenLesen, neuesteErschienen, neuSeitGesehen } from '../lib/gesehen.ts'
import { PosterKarte } from './kalender/PosterKarte.tsx'
import { useHoverCover } from './kalender/HoverCover.tsx'
import { TvKasten } from './kalender/TvKasten.tsx'
import { ZweitanbieterZeilen } from './kalender/ZweitanbieterZeilen.tsx'
import { anbieterUndFolge, zaehlung } from './kalender/Marken.tsx'

/** Ohne Uhrzeit hinter alles mit — ziffernbasiert, damit jede Kollation es hinten einsortiert. */
const OHNE_UHRZEIT = '99:99'

export interface Tag {
  date: string
  stream: ReleaseEvent[]
  /** Disc-Termine — eigener Topf (Prototyp 30.09.2026). */
  disc: ReleaseEvent[]
  tv: ReleaseEvent[]
  /** Streaming-Termine mit Zweitanbieter-Marke: zählen in `stream`, stehen aber als Zeile unter dem Raster. */
  zweit: ReleaseEvent[]
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
    /* Disc-Termine sind eine eigene Sorte: weniger interessant, gehören nicht in den Stream-Zähler. */
    const disc = alle.filter((e) => e.releaseType === 'disc')
    const stream = alle.filter((e) => e.platform !== 'tv' && e.releaseType !== 'disc')
    const imRaster = stream.filter((e) => !e.zweitanbieter)
    return {
      date,
      stream,
      disc,
      tv: alle.filter((e) => e.platform === 'tv'),
      zweit: stream.filter((e) => e.zweitanbieter),
      timed: imRaster.filter((e) => e.time),
      untimed: imRaster.filter((e) => !e.time),
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
  const heute = tag.date === today
  const vorbei = tag.date < today
  /* Ausgeschaltet bleiben Premieren sichtbar — dann steht der Kasten nur für sie da. */
  const zeigeTv = p.tvAn || tag.tv.length > 0
  /* Steht nur Zweitanbieter da, bliebe vom Raster eine leere Fläche. */
  const rasterLeer = tag.zweit.length > 0 && tag.zweit.length === tag.stream.length && tag.disc.length === 0
  const vorbeiBis = heute ? now : vorbei ? '99:99' : undefined
  return (
    <section
      data-datum={tag.date}
      data-heute={heute ? '1' : undefined}
      aria-label={`${weekdayName(tag.date)}, ${formatDate(tag.date)}`}
      className={[
        'grid grid-cols-1 gap-x-6 gap-y-3 border-t border-ak-linie py-5 lg:py-6',
        zeigeTv ? 'lg:grid-cols-[110px_minmax(0,1fr)_300px]' : 'lg:grid-cols-[110px_minmax(0,1fr)]',
        vorbei ? 'ak-vorbei' : '',
      ].join(' ')}
    >
      <TagKopf tag={tag} heute={heute} tvAn={p.tvAn} />
      <div className={['flex min-w-0 flex-col gap-4', rasterLeer && zeigeTv ? 'lg:min-h-[250px]' : ''].join(' ')}>
        {!rasterLeer && <PosterRaster tag={tag} p={p} heute={heute} now={now} landingId={landingId} landingRef={landingRef} />}
        <ZweitanbieterZeilen termine={tag.zweit} data={p.data} hidden={p.hidden} vorbeiBis={vorbeiBis} onOpen={p.onOpen} />
        <DiscKasten termine={tag.disc} data={p.data} hidden={p.hidden} onOpen={p.onOpen} />
      </div>
      {zeigeTv && <TvSpalte tag={tag} p={p} vorbeiBis={vorbeiBis} jetzt={heute ? now : undefined} />}
    </section>
  )
}

/** Rechte Spalte: der TV-Kasten rollt in Zeilenhöhe. */
function TvSpalte({ tag, p, vorbeiBis, jetzt }: { tag: Tag; p: WocheProps; vorbeiBis?: string; jetzt?: string }) {
  const kasten = (
    <TvKasten termine={tag.tv} data={p.data} hidden={p.hidden} vorbeiBis={vorbeiBis} jetzt={jetzt} onOpen={(ev) => p.onOpen(ev.releaseSlug, ev.date)} />
  )
  return (
    <div className="relative min-w-0 lg:min-h-0">
      <div className="lg:absolute lg:inset-0 lg:overflow-y-auto lg:rounded-2xl">{kasten}</div>
    </div>
  )
}

function TagKopf({ tag, heute, tvAn }: { tag: Tag; heute: boolean; tvAn: boolean }) {
  const { t } = useLang()
  const farbe = heute ? 'text-ak-akzent-text' : 'ak-titel text-ak-text'
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
          {zaehlung(tag.stream.length, tvAn ? tag.tv.length : 0, tag.disc.length, t)}
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
  const fruehste = heute ? fruehesteKommende(tag.stream, tag.date, now) : undefined
  const gruppen = buendeleKacheln(tag.stream.filter((e) => !e.zweitanbieter), (ev) => istStaffelstart(ev, p.data), (ev) => !!ev.premiere)
  const kacheln = vereineAnbieter(gruppen, eigenstaendigBeiAnbietern, kanalAnbieterVon(p.data.releaseBySlug))
  return (
    <div
      className={[
        'grid grid-cols-2 content-start gap-x-3 gap-y-5 sm:grid-cols-[repeat(auto-fill,minmax(128px,1fr))] sm:gap-x-3.5',
        'lg:min-h-[250px]',
      ].join(' ')}
    >
      {tag.stream.length === 0 && tag.disc.length === 0 && (p.gefiltert || !tag.tv.length) && (
        <p className="col-span-full pt-1 text-sm text-ak-sehr-leise">{t(p.gefiltert ? 'kal.nichtsGefiltert' : 'kal.keinTermin')}</p>
      )}
      {kacheln.map((kachel) => {
        const [ev, ...weitere] = kachel[0]!
        const bis = p.favorites.has(ev.titleId) ? gesehen[ev.titleId] : undefined
        return (
          <PosterKarte
            key={ev.id}
            event={ev}
            title={p.data.titleById.get(ev.titleId)}
            art={kachel.map((b) => kartenArt(b, p.data)).find(Boolean)}
            buendel={kachel[0]}
            anbieter={kachel.length > 1 ? kachel : undefined}
            favorite={p.favorites.has(ev.titleId)}
            hidden={p.hidden.has(ev.titleId)}
            vorbei={heute && kachel.every((b) => !!b[0]!.time && b[0]!.time < now)}
            zeitAngabe={heute ? kachelAngabe(ev, tag.date, now, fruehste) : undefined}
            neu={neuAnKarte(p, bis, ev.titleId, weitere.at(-1)?.episode ?? ev.episode)}
            anker={kachel.flat().some((e) => e.id === landingId) ? (landingRef as React.Ref<HTMLElement>) : undefined}
            onToggleFavorite={ev.titleId > 0 ? () => p.onToggleFavorite(ev.titleId) : undefined}
            onToggleHidden={ev.titleId > 0 ? () => p.onToggleHidden(ev.titleId) : undefined}
            onOpen={() => p.onOpen(ev.releaseSlug, ev.date)}
          />
        )
      })}
    </div>
  )
}

/**
 * **„Im Handel" als kompakte Liste** (30.09.2026, Daniels Wahl) — wie „Im Fernsehen", nur unter dem
 * Raster der Mittelspalte statt in einer eigenen Spalte. Disc-Termine werden damit ruhig, ohne mit
 * dem Fernseh-Kasten um Platz zu kämpfen; der Kopf zählt sie nicht mehr als Streaming-Termine.
 */
function DiscKasten({
  termine,
  data,
  hidden,
  onOpen,
}: {
  termine: ReleaseEvent[]
  data: Dataset
  hidden: Set<number>
  onOpen: (slug: string, date: string) => void
}) {
  const { t } = useLang()
  if (!termine.length) return null
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl border border-ak-linie bg-ak-flaeche/40 px-3.5 py-2.5">
      <h3 className="flex items-center gap-2 text-xs font-bold tracking-[0.1em] text-ak-leise uppercase">
        {t('card.inStores')} · {termine.length}
      </h3>
      <ul className="flex flex-col">
        {termine.map((ev) => (
          <DiscZeile
            key={ev.id}
            ev={ev}
            cover={hidden.has(ev.titleId) ? undefined : data.titleById.get(ev.titleId)?.coverImage}
            versteckt={hidden.has(ev.titleId)}
            onOpen={onOpen}
          />
        ))}
      </ul>
    </div>
  )
}

/** Eine Zeile „Im Handel"; das Cover erscheint erst, wenn eine Maus auf ihr ruht (Zeile bleibt bildlos, kein Layout-Sprung). */
function DiscZeile({
  ev,
  cover,
  versteckt,
  onOpen,
}: {
  ev: ReleaseEvent
  cover: string | undefined
  versteckt: boolean
  onOpen: (slug: string, date: string) => void
}) {
  const { t } = useLang()
  const { zeiger, vorschau } = useHoverCover(cover)
  return (
    <li {...zeiger}>
      <button
        type="button"
        onClick={() => onOpen(ev.releaseSlug, ev.date)}
        className="flex w-full cursor-pointer items-center gap-2 rounded-lg py-1 text-left text-[13px] transition hover:bg-ak-flaeche-2"
      >
        <span className="min-w-0 flex-1 truncate font-semibold text-ak-text">
          {versteckt ? <span className="text-ak-sehr-leise italic">{ev.name}</span> : ev.name}
        </span>
        <span className="shrink-0 text-xs text-ak-leise">{anbieterUndFolge(ev, t)}</span>
      </button>
      {vorschau}
    </li>
  )
}

/**
 * „N neu" steht nur an der Karte der neuesten erschienenen Folge — dieselbe Zahl wie im Panel.
 * Künftige Folgen tragen keine Marke: Was nicht erschienen ist, ist nicht neu.
 */
function neuAnKarte(p: WocheProps, bis: number | undefined, titelId: number, folge: number | undefined): number {
  if (bis === undefined || !folge) return 0
  const neueste = neuesteErschienen(p.data.events, titelId, todayIso(), nowHhMm())
  return folge === neueste ? neuSeitGesehen(bis, neueste) : 0
}
