import { useMemo, type CSSProperties } from 'react'
import type { ReleaseEvent } from '@shared/types.ts'
import { PLATFORMS } from '@shared/types.ts'
import type { Dataset } from '../lib/data.ts'
import { addDays, diffDays, formatDate, startOfMonth, startOfWeek, todayIso, weekdayName } from '@shared/time.ts'
import { useLang } from '../lib/i18n.tsx'
import { useAbSm } from '../lib/use-breit.ts'
import { coverBild } from '../lib/cover.ts'
import { istStaffelstart } from '../lib/staffelstart.ts'
import { ART_STIL, anbieterNamenDerKachel, artName, kartenArt, randKlassen, termineDerKachel, type KartenArt } from '../lib/kachel-folgen.ts'
import { tageDerWoche, type Tag } from './WeekView.tsx'
import { buendeleKacheln } from '../lib/buendel.ts'
import { anbieterVerlauf, eigenstaendigBeiAnbietern, kanalAnbieterVon, vereineAnbieter, zeitGemeinsam, type AnbieterKachel } from '../lib/anbieter-kachel.ts'
import { AnbieterAngaben } from './kalender/AnbieterAngaben.tsx'
import { Schwebe } from './kalender/Schwebe.tsx'
import { TvKasten } from './kalender/TvKasten.tsx'
import { FernsehZeichen } from './kalender/Zeichen.tsx'
import { TREFFER_24_HOCH } from './detail/tippziel.ts'
import { anbieterUndFolge, anbieterZeile, SpracheMarke, ZeitMarke } from './kalender/Marken.tsx'
import { PremiereMarke } from './kalender/PremiereMarke.tsx'

export interface MonatProps {
  data: Dataset
  events: ReleaseEvent[]
  anchorDate: string
  hidden: Set<number>
  /** Titel-IDs der Favoriten: ihre Cover und Punkte tragen den goldenen Rand. */
  favorites?: Set<number>
  onOpen: (slug: string, date: string) => void
  /** Tag in der Woche zeigen (springt dort zu diesem Tag). */
  onPickDay: (date: string) => void
  /** Je gebündeltem Termin das ganze Bündel (`buendeleTermine`) — nur innerhalb einer Zelle gesetzt. */
  buendel?: Map<string, ReleaseEvent[]>
  /** Je Kachel ihre Auszeichnung (Staffelstart, -finale, Katalog-Release) — nur innerhalb einer Zelle gesetzt. */
  arten?: Map<string, KartenArt>
  /** Je Termin, der in seiner Zelle mehrere Anbieter vertritt, alle Bündel (`vereineAnbieter`) — nur innerhalb einer Zelle gesetzt. */
  mehrere?: Map<string, AnbieterKachel>
}

/** Wie viele Cover eine Zelle zeigt; ab einem mehr steht an der letzten Stelle „+N". */
const PLATZ = 4

/** Handy: höchstens so viele Punkte je Tag (3 × 3 in 36 px Zellbreite); darüber steht an letzter Stelle „+N". */
const PUNKTE_MAX = 9
/** So viele Titel nennt das aria-label eines Tages, dann „und N weitere". */
const LABEL_TITEL = 5

/**
 * Der Poster-Monat (26.09.2026): je Tag die Cover ohne Text. Zeigen auf ein Cover nennt Titel, Zeit
 * und Folge, ein Klick öffnet das Panel; „+N" klappt alle Termine des Tages auf, die TV-Zeile zeigt
 * beim Zeigen die Ausstrahlungen.
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

function MonatsZelle({ tag, p: alle, heute, vorbei, t }: { tag: Tag; p: MonatProps; heute: boolean; vorbei: boolean; t: ReturnType<typeof useLang>['t'] }) {
  /* Nur die Zelle, die der Bildschirm zeigt: am Handy entfällt die Cover-Zelle samt Schwebekarten. */
  const breit = useAbSm()
  /* Vier Folgen desselben Titels am selben Tag sind ein Bündel — wie in der Woche (Polar Opposites S2, 04.10.2026). */
  const gruppen = buendeleKacheln(tag.stream.filter((e) => !alle.hidden.has(e.titleId)), (ev) => istStaffelstart(ev, alle.data))
  /* Derselbe Titel bei zwei Anbietern am selben Tag ist ein Cover mit geteilter Leiste (Reborn as a Space Mercenary, 11.10.2026). */
  const kacheln = vereineAnbieter(gruppen, eigenstaendigBeiAnbietern, kanalAnbieterVon(alle.data.releaseBySlug))
  const stream = kacheln.map((k) => k[0]![0]!)
  const mehrere = new Map(kacheln.filter((k) => k.length > 1).map((k) => [k[0]![0]!.id, k]))
  const buendel = new Map(gruppen.filter((g) => g.length > 1).map((g) => [g[0]!.id, g]))
  const arten = artenDerKacheln(kacheln, alle.data)
  const p = { ...alle, mehrere, buendel, arten }
  /* Ist das Fernsehen ausgeschaltet, stehen hier nur noch Premieren (App, 19.09.2026). */
  const tv = tag.tv
  const rahmen = [
    'rounded-xl',
    heute ? 'bg-ak-heute ring-1 ring-ak-akzent ring-inset' : 'bg-ak-flaeche ring-1 ring-ak-linie ring-inset',
    vorbei ? 'ak-vorbei' : '',
  ].join(' ')
  return (
    <div className={rahmen}>
      {breit ? (
        <ZelleGross tag={tag} stream={stream} tv={tv} p={p} heute={heute} t={t} />
      ) : (
        <ZelleHandy tag={tag} stream={stream} tv={tv} p={p} heute={heute} t={t} />
      )}
    </div>
  )
}

type ZellProps = { tag: Tag; stream: ReleaseEvent[]; tv: ReleaseEvent[]; p: MonatProps; heute: boolean; t: ReturnType<typeof useLang>['t'] }

/** Ab `sm`: Tageszahl, Cover mit Details beim Zeigen, „+N" und die TV-Zeile. */
function ZelleGross({ tag, stream, tv, p, heute, t }: ZellProps) {
  const zeigen = stream.length > PLATZ ? stream.slice(0, PLATZ - 1) : stream
  const mehr = stream.length - zeigen.length
  return (
    <div className="hidden min-h-[150px] flex-col gap-2 p-2.5 sm:flex">
      <button
        type="button"
        onClick={() => p.onPickDay(tag.date)}
        aria-label={t('kal.tagOeffnen', { datum: formatDate(tag.date) })}
        className="flex cursor-pointer items-baseline gap-1.5 self-start rounded-md text-left hover:underline"
      >
        <TagesZahl tag={tag} heute={heute} />
        {heute && <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-ak-akzent-text">{t('week.today')}</span>}
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
            className={`flex cursor-pointer items-center gap-1.5 rounded-md text-xs font-bold text-ak-tv hover:underline ${TREFFER_24_HOCH}`}
            aria-label={t('kal.tvAmTag', { datum: formatDate(tag.date) })}
          >
            <FernsehZeichen groesse={14} />
            {t('kal.imTvZahl', { n: tv.length })}
          </button>
        </Schwebe>
      )}
    </div>
  )
}

/**
 * Unter `sm` ist die ganze Zelle ein Knopf (Touch-Ziel statt 22 px großer Cover): Er klappt alle
 * Termine des Tages auf; ein leerer Tag führt direkt in die Woche.
 */
function ZelleHandy({ tag, stream, tv, p, heute, t }: ZellProps) {
  const datum = formatDate(tag.date)
  const knopf = (
    <button
      type="button"
      onClick={stream.length + tv.length ? undefined : () => p.onPickDay(tag.date)}
      aria-label={stream.length + tv.length ? punkteLabel(stream, tv.length, datum, p, t) : t('kal.tagOeffnen', { datum })}
      className="flex size-full min-h-[74px] cursor-pointer flex-col items-start gap-1 p-1.5 text-left"
    >
      <TagesZahl tag={tag} heute={heute} />
      <PunkteReihe stream={stream} p={p} />
      {tv.length > 0 && (
        <span className="mt-auto flex items-center gap-0.5 text-[11px] font-bold text-ak-tv">
          <FernsehZeichen groesse={11} />
          {tv.length}
        </span>
      )}
    </button>
  )
  if (!stream.length && !tv.length) return <div className="flex sm:hidden">{knopf}</div>
  return (
    <Schwebe art="klick" breite={360} label={t('kal.alleAmTag', { datum })} className="flex h-full sm:hidden" inhalt={<TagesListe tag={tag} stream={stream} tv={tv} p={p} />}>
      {knopf}
    </Schwebe>
  )
}

/** Am Handy ein Punkt je Streaming-Termin in der Anbieterfarbe statt 22 px großer Cover (kein Bild geladen); die Titel nennt der Knopf per aria-label und die Tagesliste. */
export function PunkteReihe({ stream, p }: { stream: ReleaseEvent[]; p: MonatProps }) {
  const zeigen = stream.length > PUNKTE_MAX ? stream.slice(0, PUNKTE_MAX - 1) : stream
  const mehr = stream.length - zeigen.length
  return (
    <span className="flex flex-wrap content-start gap-[3px]" aria-hidden="true">
      {zeigen.map((ev) => (
        <span
          key={ev.id}
          data-monatspunkt
          data-art={p.arten?.get(ev.id)}
          data-favorit={p.favorites?.has(ev.titleId) ? '' : undefined}
          className="ak-punkt block size-2.5 rounded-full"
          style={{ '--punkt': PLATFORMS[ev.platform]?.color, background: farbleiste(ev, p) } as CSSProperties}
        />
      ))}
      {mehr > 0 && <span className="text-[10px] leading-[10px] font-extrabold text-ak-text">+{mehr}</span>}
    </span>
  )
}

/** Farbe und Ring tragen nie allein: Der Knopf nennt Titel, Anbieter und Staffelstart/-finale der ersten Termine. */
export function punkteLabel(stream: ReleaseEvent[], tvZahl: number, datum: string, p: MonatProps, t: ReturnType<typeof useLang>['t']): string {
  const titel = stream.slice(0, LABEL_TITEL).map((ev) => {
    const a = p.arten?.get(ev.id)
    const koepfe = (p.mehrere?.get(ev.id) ?? [[ev]]).map((b) => b[0]!)
    const termine = termineDerKachel(ev, p.mehrere, p.buendel)
    const anbieter = anbieterNamenDerKachel(koepfe, a, termine).join(' + ')
    return `${ev.name} (${[anbieter, a ? artName(a, termine, t) : ''].filter(Boolean).join(', ')})`
  })
  const rest = stream.length - titel.length
  const teile = [...titel, ...(rest > 0 ? [t('kal.undWeitere', { n: rest })] : []), ...(tvZahl ? [t('kal.imTvZahl', { n: tvZahl })] : [])]
  return t('kal.tagMitTiteln', { datum, titel: teile.join(', ') })
}

function TagesZahl({ tag, heute }: { tag: Tag; heute: boolean }) {
  return (
    <span className={`font-display text-sm font-bold sm:text-lg ${heute ? 'text-ak-akzent-text' : 'ak-titel text-ak-text'}`}>
      {Number(tag.date.slice(8))}
    </span>
  )
}

/** Die Art jeder Kachel: die erste, die einer ihrer Anbieter-Bündel trägt (wie in der Woche). */
function artenDerKacheln(kacheln: AnbieterKachel[], data: Dataset): Map<string, KartenArt> {
  const arten = new Map<string, KartenArt>()
  for (const k of kacheln) {
    const art = k.map((b) => kartenArt(b, data)).find(Boolean)
    if (art) arten.set(k[0]![0]!.id, art)
  }
  return arten
}

/** Die Leiste bzw. der Punkt in Anbieterfarbe, bei mehreren Anbietern geteilt. */
function farbleiste(ev: ReleaseEvent, p: MonatProps): string {
  return anbieterVerlauf((p.mehrere?.get(ev.id) ?? [[ev]]).map((b) => PLATFORMS[b[0]!.platform]?.color ?? '#888'))
}

/** Ein Cover ohne Text: Zeigen nennt die Einzelheiten, ein Klick öffnet das Panel. */
export function CoverKnopf({ ev, p }: { ev: ReleaseEvent; p: MonatProps }) {
  const { t } = useLang()
  const cover = p.data.titleById.get(ev.titleId)?.coverImage
  const favorit = !!p.favorites?.has(ev.titleId)
  const a = p.arten?.get(ev.id)
  const rand = randKlassen(a, favorit)
  return (
    <Schwebe art="zeigen" breite={300} inhalt={<TerminZeile ev={ev} p={p} gross />}>
      <button
        type="button"
        onClick={() => p.onOpen(ev.releaseSlug, ev.date)}
        aria-label={`${ev.name} — ${(p.mehrere?.get(ev.id) ?? [p.buendel?.get(ev.id) ?? [ev]]).map((b) => anbieterUndFolge(b[0]!, t, b)).join('; ')}`}
        className={[
          'ak-ring-oben relative block h-8 w-[22px] shrink-0 cursor-pointer overflow-hidden rounded-t-[5px] bg-ak-flaeche-2 transition hover:scale-105 focus-visible:-outline-offset-2 sm:h-14 sm:w-[38px] sm:rounded-t-md',
          a || favorit ? 'ring-2' : '',
          rand.aussen,
        ].join(' ')}
      >
        {cover && <img {...coverBild(cover, 38)} alt="" loading="lazy" className="size-full object-cover" />}
        {rand.innen && <span className={`pointer-events-none absolute inset-0 rounded-t-[5px] border border-ak-flaeche inset-ring-2 sm:rounded-t-md ${rand.innen}`} />}
        <span className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: farbleiste(ev, p) }} />
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
        className="flex h-8 w-[22px] cursor-pointer items-center justify-center rounded-[5px] bg-ak-flaeche-2 text-[10px] font-extrabold text-ak-text transition hover:bg-ak-flaeche-3 sm:h-14 sm:w-[38px] sm:rounded-md sm:text-[13px]"
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
export function TerminZeile({ ev, p, gross }: { ev: ReleaseEvent; p: MonatProps; gross?: boolean }) {
  const { t } = useLang()
  const cover = p.data.titleById.get(ev.titleId)?.coverImage
  const favorit = !!p.favorites?.has(ev.titleId)
  const a = p.arten?.get(ev.id)
  const kachel = p.mehrere?.get(ev.id)
  return (
    <button
      type="button"
      data-schliesst
      onClick={() => p.onOpen(ev.releaseSlug, ev.date)}
      className="grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 rounded-xl p-1.5 text-left transition hover:bg-ak-flaeche-2"
    >
      <span className={`relative block ${gross ? 'h-24 w-16' : 'h-14 w-10'}`}>
        <span className={`ak-ring-oben-leiste absolute inset-0 overflow-hidden rounded-t-md bg-ak-flaeche-2 ${favorit ? 'ring-2 ring-ak-favorit-rand' : ''}`}>
          {cover && <img {...coverBild(cover, gross ? 64 : 40)} alt="" loading="lazy" className="size-full object-cover" />}
        </span>
        <span className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: farbleiste(ev, p) }} />
      </span>
      <span className="flex min-w-0 flex-col items-start gap-1">
        <span className="flex flex-wrap items-center gap-1.5">
          {(!kachel || zeitGemeinsam(kachel)) && <ZeitMarke event={ev} t={t} />}
          <SpracheMarke event={ev} t={t} />
          {a && (
            <span className={`rounded-full px-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#0d0f14] ${ART_STIL[a].fahne}`}>
              {artName(a, termineDerKachel(ev, p.mehrere, p.buendel), t)}
            </span>
          )}
          {ev.premiere && <PremiereMarke platform={ev.platform} vorher={ev.premiereVorher} className="px-1.5" />}
        </span>
        <span className="line-clamp-2 text-[13px] font-bold leading-snug text-ak-text">{ev.name}</span>
        <span className="text-xs text-ak-leise">
          {kachel ? <AnbieterAngaben kachel={kachel} t={t} /> : anbieterZeile(ev, t, p.buendel?.get(ev.id), a)}
        </span>
      </span>
    </button>
  )
}
