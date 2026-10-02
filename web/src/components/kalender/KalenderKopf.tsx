import type { ViewId } from '../../lib/router.ts'
import { addDays, addMonths, diffDays, formatDateLong, monthName, startOfWeek, todayIso } from '@shared/time.ts'
import { useLang, type Translate } from '../../lib/i18n.tsx'
import { DatumSprung } from '../DatumSprung.tsx'
import { FilterZeichen, LinksZeichen, RechtsZeichen } from './Zeichen.tsx'
import { Tooltip } from '../ui.tsx'

/** ISO-Kalenderwoche: die Woche, in der der Donnerstag liegt. */
function kalenderwoche(iso: string): number {
  const donnerstag = addDays(startOfWeek(iso), 3)
  const jan1 = `${donnerstag.slice(0, 4)}-01-01`
  return Math.floor(diffDays(jan1, donnerstag) / 7) + 1
}

/** „Diese Woche", „Nächste Woche", „Letzte Woche", sonst „KW 42". */
export function wochenTitel(date: string, t: Translate): string {
  const abstand = Math.round(diffDays(startOfWeek(todayIso()), startOfWeek(date)) / 7)
  if (abstand === 0) return t('kal.dieseWoche')
  if (abstand === 1) return t('kal.naechsteWoche')
  if (abstand === -1) return t('kal.letzteWoche')
  return t('kal.kw', { n: kalenderwoche(date) })
}

/** „21.–27. September 2026" — den Monat nur einmal nennen, sonst bricht es auf dem Handy um (18.09.2026). */
export function wochenSpanne(date: string): string {
  const monday = startOfWeek(date)
  const sunday = addDays(monday, 6)
  const [y1, m1, d1] = monday.split('-').map(Number)
  const [y2, m2, d2] = sunday.split('-').map(Number)
  if (y1 !== y2) return `${formatDateLong(monday)} – ${formatDateLong(sunday)}`
  if (m1 !== m2) return `${d1}. ${monthName(m1 - 1)} – ${d2}. ${monthName(m2 - 1)} ${y2}`
  return `${d1}.–${d2}. ${monthName(m2 - 1)} ${y2}`
}

export function monatsTitel(date: string): string {
  const [y, m] = date.split('-').map(Number)
  return `${monthName(m - 1)} ${y}`
}

/** Überschrift des Kalenders: „Diese Woche" bzw. „September 2026", daneben Spanne oder Zählung. */
export function KalenderKopf({ view, date, unterzeile }: { view: ViewId; date: string; unterzeile: string }) {
  const { t } = useLang()
  const monat = view === 'monat'
  return (
    <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
      <h1 className="font-display text-[26px] leading-tight font-bold tracking-[-0.02em] text-ak-text sm:text-[34px]">
        {monat ? monatsTitel(date) : wochenTitel(date, t)}
      </h1>
      <span className="text-sm text-ak-leise sm:text-base">{unterzeile}</span>
    </div>
  )
}

export interface SteuerProps {
  view: ViewId
  date: string
  filterOffen: boolean
  filterAnzahl: number
  termine: { alle: string[]; sichtbar: string[] }
  onFilter: () => void
  onDate: (d: string) => void
  onWoche: () => void
  onMonat: () => void
}

/**
 * **Die Steuerleiste dockt unten am Bildschirmrand an**. Wer ganz unten im Monat oder am Sonntag
 * ist, blättert, filtert und
 * springt zu heute, ohne zurückzurollen. Auf dem Handy sitzt sie über der Navigation.
 */
export function Steuerleiste(p: SteuerProps) {
  const { t } = useLang()
  const monat = p.view === 'monat'
  const schritt = (dir: number) => p.onDate(monat ? addMonths(p.date, dir) : addDays(p.date, dir * 7))
  const heuteSichtbar = monat ? todayIso().slice(0, 7) === p.date.slice(0, 7) : startOfWeek(todayIso()) === startOfWeek(p.date)
  const rund = 'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-ak-rand bg-ak-flaeche text-ak-text transition hover:border-ak-leise'
  return (
    <div
      data-steuerleiste
      className="pointer-events-none fixed inset-x-2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex justify-center md:bottom-2"
    >
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-ak-rand bg-ak-flaeche/95 p-1.5 shadow-[0_12px_32px_rgba(0,0,0,.35)] backdrop-blur sm:gap-2">
        <div role="group" aria-label={t('kal.zeitraum')} className="flex rounded-full bg-ak-flaeche-2 p-0.5">
          <Segment an={!monat} onClick={p.onWoche}>{t('view.woche')}</Segment>
          <Segment an={monat} onClick={p.onMonat}>{t('view.monat')}</Segment>
        </div>
        <button
          type="button"
          onClick={p.onFilter}
          aria-expanded={p.filterOffen}
          aria-controls="ak-filterfeld"
          aria-label={t('filter.button')}
          className={[
            'flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-bold transition sm:pr-4 sm:pl-3.5',
            p.filterOffen || p.filterAnzahl ? 'border-ak-akzent bg-ak-akzent text-ak-auf-akzent' : 'border-ak-rand bg-ak-flaeche text-ak-text hover:border-ak-leise',
          ].join(' ')}
        >
          <FilterZeichen />
          <span className="hidden sm:inline">{t('filter.button')}</span>
          {p.filterAnzahl > 0 && <span className="rounded-full bg-[#0d0f14] px-1.5 text-[11px] text-[#f2f1ee]">{p.filterAnzahl}</span>}
        </button>
        <button type="button" onClick={() => schritt(-1)} aria-label={t('kal.voriger')} className={rund}>
          <LinksZeichen />
        </button>
        {/* In der Woche bleibt „heute" klickbar und scrollt zum heutigen Tag. */}
        <Tooltip text={heuteSichtbar ? (monat ? t('nav.todayHere') : t('nav.todayScroll')) : t('nav.todayGo')} seite="oben" eigenerFokus>
          <button
            type="button"
            onClick={() => {
              p.onDate(todayIso())
              if (!monat) window.dispatchEvent(new Event('ak-zu-heute'))
            }}
            disabled={heuteSichtbar && monat}
            className="h-11 shrink-0 cursor-pointer rounded-full border border-ak-rand bg-ak-flaeche px-3 text-sm font-bold text-ak-text transition hover:border-ak-leise disabled:cursor-default disabled:opacity-40 sm:px-4"
          >
            {t('nav.today')}
          </button>
        </Tooltip>
        <button type="button" onClick={() => schritt(1)} aria-label={t('kal.naechster')} className={rund}>
          <RechtsZeichen />
        </button>
        <span className="hidden sm:flex">
          <DatumSprung date={p.date} termine={p.termine} onDate={p.onDate} />
        </span>
      </div>
    </div>
  )
}

function Segment({ an, onClick, children }: { an: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={an}
      onClick={onClick}
      className={[
        'h-10 cursor-pointer rounded-full px-3 text-sm font-bold transition sm:px-4',
        an ? 'bg-ak-akzent text-ak-auf-akzent' : 'text-ak-leise hover:text-ak-text',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
