import { useMemo } from 'react'
import type { ReleaseEvent } from '@shared/types.ts'
import { PLATFORMS } from '@shared/types.ts'
import type { Dataset } from '../lib/data.ts'
import { addDays, diffDays, formatDate, startOfMonth, startOfWeek, todayIso, weekdayName } from '@shared/time.ts'
import { useLang } from '../lib/i18n.tsx'
import { coverBild } from '../lib/cover.ts'
import { istStaffelfinale, istStaffelstart } from '../lib/staffelstart.ts'
import { tageDerWoche, type Tag } from './WeekView.tsx'
import { Schwebe } from './kalender/Schwebe.tsx'
import { TvKasten } from './kalender/TvKasten.tsx'
import { FernsehZeichen } from './kalender/Zeichen.tsx'
import { anbieterUndFolge, ZeitMarke } from './kalender/Marken.tsx'

export interface MonatProps {
  data: Dataset
  events: ReleaseEvent[]
  anchorDate: string
  hidden: Set<number>
  onOpen: (slug: string, date: string) => void
  /** Tag in der Woche zeigen (springt dort zu diesem Tag). */
  onPickDay: (date: string) => void
}

/** Wie viele Cover eine Zelle zeigt; ab einem mehr steht an der letzten Stelle „+N". */
const PLATZ = 4

/**
 * Der Poster-Monat (26.09.2026): je Tag die Cover ohne Text. Zeigen auf ein Cover nennt Titel, Zeit
 * und Folge, ein Klick öffnet das Panel; „+N" klappt alle Termine des Tages auf, die TV-Zeile zeigt
 * beim Zeigen die Ausstrahlungen (Daniel, 26.09.2026).
 */
export function MonthView(p: MonatProps) {
  const { t } = useLang()
  const today = todayIso()
  const monat = p.anchorDate.slice(0, 7)
  const erster = startOfMonth(p.anchorDate)
  const versatz = diffDays(startOfWeek(erster), erster)
  const tage = useMemo(() => {
    const alle: Tag[] = []
    for (let montag = startOfWeek(erster); montag.slice(0, 7) <= monat; montag = addDays(montag, 7))
      alle.push(...tageDerWoche(p.events, montag))
    return alle.filter((tag) => tag.date.slice(0, 7) === monat)
  }, [p.events, erster, monat])

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-7 gap-1 sm:gap-2" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className="px-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-ak-leise">
            {weekdayName(addDays(startOfWeek(erster), i), true)}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {Array.from({ length: versatz }, (_, i) => (
          <span key={`leer-${i}`} />
        ))}
        {tage.map((tag) => (
          <MonatsZelle key={tag.date} tag={tag} p={p} heute={tag.date === today} vorbei={tag.date < today} t={t} />
        ))}
      </div>
    </div>
  )
}

function MonatsZelle({ tag, p, heute, vorbei, t }: { tag: Tag; p: MonatProps; heute: boolean; vorbei: boolean; t: ReturnType<typeof useLang>['t'] }) {
  const stream = tag.stream.filter((e) => !p.hidden.has(e.titleId))
  /* Ist das Fernsehen ausgeschaltet, stehen hier nur noch Premieren (App, 19.09.2026). */
  const tv = tag.tv
  const zeigen = stream.length > PLATZ ? stream.slice(0, PLATZ - 1) : stream
  const mehr = stream.length - zeigen.length
  return (
    <div
      className={[
        'flex min-h-[74px] flex-col gap-1.5 rounded-xl p-1.5 sm:min-h-[150px] sm:gap-2 sm:p-2.5',
        heute ? 'bg-ak-heute ring-1 ring-ak-akzent ring-inset' : 'bg-ak-flaeche ring-1 ring-ak-linie ring-inset',
        vorbei ? 'opacity-[0.62] transition-opacity hover:opacity-100' : '',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={() => p.onPickDay(tag.date)}
        aria-label={t('kal.tagOeffnen', { datum: formatDate(tag.date) })}
        className="flex cursor-pointer items-baseline gap-1.5 self-start rounded-md text-left hover:underline"
      >
        <span className={`font-display text-sm font-bold sm:text-lg ${heute ? 'text-ak-akzent-text' : 'text-ak-text'}`}>
          {Number(tag.date.slice(8))}
        </span>
        {heute && <span className="hidden text-[11px] font-bold uppercase tracking-[0.08em] text-ak-akzent-text sm:inline">{t('week.today')}</span>}
      </button>
      <div className="flex flex-wrap gap-1">
        {zeigen.map((ev) => (
          <CoverKnopf key={ev.id} ev={ev} p={p} />
        ))}
        {mehr > 0 && <MehrKnopf tag={tag} stream={stream} tv={tv} mehr={mehr} p={p} />}
      </div>
      {tv.length > 0 && (
        <Schwebe art="beides" breite={340} label={t('kal.tvAmTag', { datum: formatDate(tag.date) })} className="mt-auto block" inhalt={<TvInhalt tag={tag} p={p} />}>
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1.5 rounded-md text-xs font-bold text-ak-tv hover:underline"
            aria-label={t('kal.tvAmTag', { datum: formatDate(tag.date) })}
          >
            <FernsehZeichen groesse={14} />
            <span className="hidden sm:inline">{t('kal.imTvZahl', { n: tv.length })}</span>
            <span className="sm:hidden">{tv.length}</span>
          </button>
        </Schwebe>
      )}
    </div>
  )
}

function art(ev: ReleaseEvent, data: Dataset): 'start' | 'finale' | undefined {
  return istStaffelstart(ev, data) ? 'start' : istStaffelfinale(ev, data) ? 'finale' : undefined
}

/** Ein Cover ohne Text: Zeigen nennt die Einzelheiten, ein Klick öffnet das Panel. */
function CoverKnopf({ ev, p }: { ev: ReleaseEvent; p: MonatProps }) {
  const { t } = useLang()
  const cover = p.data.titleById.get(ev.titleId)?.coverImage
  const a = art(ev, p.data)
  return (
    <Schwebe art="zeigen" breite={300} inhalt={<TerminZeile ev={ev} p={p} gross />}>
      <button
        type="button"
        onClick={() => p.onOpen(ev.releaseSlug, ev.date)}
        aria-label={`${ev.name} — ${anbieterUndFolge(ev, t)}`}
        className={[
          'relative block h-8 w-[22px] shrink-0 cursor-pointer overflow-hidden rounded-[5px] bg-ak-flaeche-2 transition hover:scale-105 sm:h-14 sm:w-[38px] sm:rounded-md',
          a === 'start' ? 'ring-2 ring-ak-akzent' : a === 'finale' ? 'ring-2 ring-ak-finale' : '',
        ].join(' ')}
      >
        {cover && <img {...coverBild(cover, 38)} alt="" loading="lazy" className="size-full object-cover" />}
        <span className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: PLATFORMS[ev.platform]?.color }} />
      </button>
    </Schwebe>
  )
}

function MehrKnopf({ tag, stream, tv, mehr, p }: { tag: Tag; stream: ReleaseEvent[]; tv: ReleaseEvent[]; mehr: number; p: MonatProps }) {
  const { t } = useLang()
  const datum = formatDate(tag.date)
  return (
    <Schwebe art="klick" breite={360} label={t('kal.alleAmTag', { datum })} inhalt={<TagesListe tag={tag} stream={stream} tv={tv} p={p} />}>
      <button
        type="button"
        aria-label={t('kal.mehrLabel', { n: stream.length, datum })}
        className="flex h-8 w-[22px] cursor-pointer items-center justify-center rounded-[5px] bg-ak-flaeche-2 text-[10px] font-extrabold text-ak-text transition hover:bg-ak-rand sm:h-14 sm:w-[38px] sm:rounded-md sm:text-[13px]"
      >
        +{mehr}
      </button>
    </Schwebe>
  )
}

/** Alle Termine eines Tages in der aufgeklappten Karte: erst Streaming, dann Fernsehen. */
function TagesListe({ tag, stream, tv, p }: { tag: Tag; stream: ReleaseEvent[]; tv: ReleaseEvent[]; p: MonatProps }) {
  const { t } = useLang()
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 px-1.5 pt-0.5 pb-1">
        <span className="font-display text-sm font-bold">{`${weekdayName(tag.date, true)}, ${formatDate(tag.date)}`}</span>
        <button type="button" data-schliesst onClick={() => p.onPickDay(tag.date)} className="cursor-pointer text-xs font-bold text-ak-akzent-text hover:underline">
          {t('kal.zurWoche')}
        </button>
      </div>
      {stream.map((ev) => (
        <TerminZeile key={ev.id} ev={ev} p={p} />
      ))}
      {tv.length > 0 && (
        <>
          <span className="flex items-center gap-1.5 px-1.5 pt-2 text-[11px] font-bold uppercase tracking-[0.1em] text-ak-tv">
            <FernsehZeichen groesse={14} /> {t('kal.imTv')}
          </span>
          <div className="px-1.5">
            <TvKasten termine={tv} data={p.data} hidden={p.hidden} onOpen={(ev) => p.onOpen(ev.releaseSlug, ev.date)} kompakt />
          </div>
        </>
      )}
    </div>
  )
}

function TvInhalt({ tag, p }: { tag: Tag; p: MonatProps }) {
  const { t } = useLang()
  return (
    <div className="flex flex-col gap-1 px-1.5">
      <span className="flex items-center gap-1.5 pt-0.5 pb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-ak-tv">
        <FernsehZeichen groesse={14} /> {t('kal.tvAmTag', { datum: formatDate(tag.date) })}
      </span>
      <TvKasten termine={tag.tv} data={p.data} hidden={p.hidden} onOpen={(ev) => p.onOpen(ev.releaseSlug, ev.date)} kompakt />
    </div>
  )
}

/** Eine Zeile mit Cover, Zeit, Titel und „Anbieter · Folge" — in der Hover-Karte groß. */
function TerminZeile({ ev, p, gross }: { ev: ReleaseEvent; p: MonatProps; gross?: boolean }) {
  const { t } = useLang()
  const cover = p.data.titleById.get(ev.titleId)?.coverImage
  const a = art(ev, p.data)
  return (
    <button
      type="button"
      data-schliesst
      onClick={() => p.onOpen(ev.releaseSlug, ev.date)}
      className="grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 rounded-xl p-1.5 text-left transition hover:bg-ak-flaeche-2"
    >
      <span className={`relative block overflow-hidden rounded-md bg-ak-flaeche-2 ${gross ? 'h-24 w-16' : 'h-14 w-10'}`}>
        {cover && <img {...coverBild(cover, gross ? 64 : 40)} alt="" loading="lazy" className="size-full object-cover" />}
        <span className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: PLATFORMS[ev.platform]?.color }} />
      </span>
      <span className="flex min-w-0 flex-col items-start gap-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <ZeitMarke event={ev} t={t} />
          {a && (
            <span className={`rounded-full px-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#0d0f14] ${a === 'start' ? 'bg-ak-akzent' : 'bg-ak-finale'}`}>
              {t(a === 'start' ? 'kal.start' : 'kal.finale')}
            </span>
          )}
        </span>
        <span className="line-clamp-2 text-[13px] font-bold leading-snug text-ak-text">{ev.name}</span>
        <span className="text-xs text-ak-leise">{anbieterUndFolge(ev, t)}</span>
      </span>
    </button>
  )
}
