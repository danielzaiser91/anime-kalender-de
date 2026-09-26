import type { ViewId } from '../../lib/router.ts'
import { addDays, addMonths, diffDays, formatDateLong, monthName, startOfWeek, todayIso } from '@shared/time.ts'
import { useLang, type Translate } from '../../lib/i18n.tsx'
import { DatumSprung } from '../DatumSprung.tsx'
import { FilterZeichen, LinksZeichen, RechtsZeichen } from './Zeichen.tsx'

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

/**
 * Kopf des Kalenders: Überschrift, Umschalter Woche ⇄ Monat, Filter, Blättern, „heute" und die
 * Datumsauswahl. Die Pfeile blättern je nach Ansicht um eine Woche oder einen Monat.
 */
export function KalenderKopf({
  view,
  date,
  unterzeile,
  filterOffen,
  filterAnzahl,
  termine,
  onFilter,
  onDate,
  onWoche,
  onMonat,
}: {
  view: ViewId
  date: string
  unterzeile: string
  filterOffen: boolean
  filterAnzahl: number
  termine: { alle: string[]; sichtbar: string[] }
  onFilter: () => void
  onDate: (d: string) => void
  onWoche: () => void
  onMonat: () => void
}) {
  const { t } = useLang()
  const monat = view === 'monat'
  const schritt = (dir: number) => onDate(monat ? addMonths(date, dir) : addDays(date, dir * 7))
  const heuteSichtbar = monat ? todayIso().slice(0, 7) === date.slice(0, 7) : startOfWeek(todayIso()) === startOfWeek(date)
  const rund = 'flex size-11 cursor-pointer items-center justify-center rounded-full border border-ak-rand bg-ak-flaeche text-ak-text transition hover:border-ak-leise'
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
      <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
        <h1 className="font-display text-[26px] leading-tight font-bold tracking-[-0.02em] text-ak-text sm:text-[34px]">
          {monat ? monatsTitel(date) : wochenTitel(date, t)}
        </h1>
        <span className="text-sm text-ak-leise sm:text-base">{unterzeile}</span>
      </div>
      <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:ml-auto sm:w-auto sm:justify-end">
        <div className="flex items-center gap-2">
        <div role="group" aria-label={t('kal.zeitraum')} className="flex rounded-full border border-ak-rand bg-ak-flaeche p-1">
          <Segment an={!monat} onClick={onWoche}>{t('view.woche')}</Segment>
          <Segment an={monat} onClick={onMonat}>{t('view.monat')}</Segment>
        </div>
        <button
          type="button"
          onClick={onFilter}
          aria-expanded={filterOffen}
          aria-controls="ak-filterfeld"
          className={[
            'flex h-11 cursor-pointer items-center gap-2 rounded-full border pr-4 pl-3.5 text-sm font-bold transition',
            filterOffen || filterAnzahl ? 'border-ak-akzent bg-ak-akzent text-ak-auf-akzent' : 'border-ak-rand bg-ak-flaeche text-ak-text hover:border-ak-leise',
          ].join(' ')}
        >
          <FilterZeichen />
          {t('filter.button')}
          {filterAnzahl > 0 && <span className="rounded-full bg-[#0d0f14] px-1.5 text-[11px] text-[#f2f1ee]">{filterAnzahl}</span>}
        </button>
        </div>
        <div className="flex items-center gap-2">
        <button type="button" onClick={() => schritt(-1)} aria-label={t('kal.voriger')} className={rund}>
          <LinksZeichen />
        </button>
        {/* In der Woche bleibt „heute" klickbar und scrollt zum heutigen Tag (Daniel, 25.09.2026). */}
        <button
          type="button"
          onClick={() => {
            onDate(todayIso())
            if (!monat) window.dispatchEvent(new Event('ak-zu-heute'))
          }}
          disabled={heuteSichtbar && monat}
          title={heuteSichtbar ? (monat ? t('nav.todayHere') : t('nav.todayScroll')) : t('nav.todayGo')}
          className="h-11 cursor-pointer rounded-full border border-ak-rand bg-ak-flaeche px-4 text-sm font-bold text-ak-text transition hover:border-ak-leise disabled:cursor-default disabled:opacity-40"
        >
          {t('nav.today')}
        </button>
        <button type="button" onClick={() => schritt(1)} aria-label={t('kal.naechster')} className={rund}>
          <RechtsZeichen />
        </button>
        <DatumSprung date={date} termine={termine} onDate={onDate} />
        </div>
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
        'h-9 cursor-pointer rounded-full px-4 text-sm font-bold transition',
        an ? 'bg-ak-akzent text-ak-auf-akzent' : 'text-ak-leise hover:text-ak-text',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
