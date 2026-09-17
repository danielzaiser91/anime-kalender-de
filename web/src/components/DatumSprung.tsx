import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { formatDate, monthName, todayIso, weekdayIndex } from '@shared/time.ts'
import { useLang } from '../lib/i18n.tsx'

/**
 * **Sprung zu einem Datum** (Daniel, 17.09.2026: „kalender icon hinzufügen → klick:
 * öffnet auswahl, übersichtlich, sodass man schnell zu einem datum in
 * zukunft/vergangenheit springen kann").
 *
 * Zwei Stufen: erst Jahr und Monat, dann der Tag. Jeder Monat trägt die Zahl
 * seiner Termine, damit man sieht, wo etwas los ist. Der Bereich reicht vom
 * frühesten bis zum spätesten Termin im Bestand — außerhalb gibt es nichts zu
 * sehen, also ist dort nichts wählbar.
 */
export function DatumSprung({
  date,
  termine,
  onDate,
}: {
  date: string
  /** Die Tage aller Termine (ungefiltert für den Bereich, gefiltert für die Zählung). */
  termine: { alle: string[]; sichtbar: string[] }
  onDate: (d: string) => void
}) {
  const { t } = useLang()
  const heute = todayIso()
  const [offen, setOffen] = useState(false)
  const [jahr, setJahr] = useState(Number(date.slice(0, 4)))
  const [monat, setMonat] = useState<number | null>(null)
  const knopf = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const { von, bis } = useMemo(() => {
    let von = heute
    let bis = heute
    for (const d of termine.alle) {
      if (d < von) von = d
      if (d > bis) bis = d
    }
    return { von, bis }
  }, [termine.alle, heute])

  /* Termine je Monat („2026-11") und je Tag, aus der gefilterten Ansicht. */
  const { jeMonat, jeTag } = useMemo(() => {
    const jeMonat = new Map<string, number>()
    const jeTag = new Map<string, number>()
    for (const d of termine.sichtbar) {
      jeMonat.set(d.slice(0, 7), (jeMonat.get(d.slice(0, 7)) ?? 0) + 1)
      jeTag.set(d, (jeTag.get(d) ?? 0) + 1)
    }
    return { jeMonat, jeTag }
  }, [termine.sichtbar])

  useEffect(() => {
    if (!offen) return
    const zu = (e: KeyboardEvent) => e.key === 'Escape' && setOffen(false)
    const weg = () => setOffen(false)
    window.addEventListener('keydown', zu)
    window.addEventListener('resize', weg)
    return () => {
      window.removeEventListener('keydown', zu)
      window.removeEventListener('resize', weg)
    }
  }, [offen])

  const oeffnen = () => {
    if (offen) return setOffen(false)
    const r = knopf.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 296)) })
    setJahr(Number(date.slice(0, 4)))
    setMonat(null)
    setOffen(true)
  }
  const springe = (d: string) => {
    onDate(d < von ? von : d > bis ? bis : d)
    setOffen(false)
  }

  const minJahr = Number(von.slice(0, 4))
  const maxJahr = Number(bis.slice(0, 4))
  const monatKey = (m: number) => `${jahr}-${String(m + 1).padStart(2, '0')}`
  const monatErlaubt = (m: number) => monatKey(m) >= von.slice(0, 7) && monatKey(m) <= bis.slice(0, 7)

  const zelle =
    'flex cursor-pointer flex-col items-center justify-center rounded-lg py-1.5 text-xs transition disabled:cursor-default disabled:opacity-30'

  let inhalt: ReactNode
  if (monat === null) {
    inhalt = (
      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: 12 }, (_, m) => {
          const key = monatKey(m)
          const n = jeMonat.get(key) ?? 0
          const aktiv = key === date.slice(0, 7)
          return (
            <button
              key={m}
              type="button"
              disabled={!monatErlaubt(m)}
              onClick={() => setMonat(m)}
              className={[
                zelle,
                aktiv ? 'bg-sky-500/20 text-sky-700 dark:text-sky-200' : 'hover:bg-slate-200/70 dark:hover:bg-white/10',
                key === heute.slice(0, 7) ? 'ring-1 ring-sky-500/60' : '',
              ].join(' ')}
            >
              <span className="font-medium">{monthName(m).slice(0, 3)}</span>
              <span className="tabular-nums text-[10px] opacity-70">{n ? n : '–'}</span>
            </button>
          )
        })}
      </div>
    )
  } else {
    const erster = `${monatKey(monat)}-01`
    const tage = new Date(jahr, monat + 1, 0).getDate()
    const versatz = weekdayIndex(erster)
    inhalt = (
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((w) => (
          <span key={w} className="py-1 text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">
            {w}
          </span>
        ))}
        {Array.from({ length: versatz }, (_, i) => (
          <span key={`l${i}`} />
        ))}
        {Array.from({ length: tage }, (_, i) => {
          const d = `${monatKey(monat)}-${String(i + 1).padStart(2, '0')}`
          const n = jeTag.get(d) ?? 0
          return (
            <button
              key={d}
              type="button"
              disabled={d < von || d > bis}
              onClick={() => springe(d)}
              title={n ? t('sprung.termine', { n }) : undefined}
              className={[
                'relative cursor-pointer rounded-md py-1.5 text-xs tabular-nums transition disabled:cursor-default disabled:opacity-30',
                d === date ? 'bg-sky-500/25 font-semibold' : 'hover:bg-slate-200/70 dark:hover:bg-white/10',
                d === heute ? 'ring-1 ring-sky-500/60' : '',
              ].join(' ')}
            >
              {i + 1}
              {n > 0 && <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-sky-500" />}
            </button>
          )
        })}
      </div>
    )
  }

  const kopfKnopf =
    'cursor-pointer rounded-md px-2 py-1 text-sm transition hover:bg-slate-200/70 disabled:cursor-default disabled:opacity-30 dark:hover:bg-white/10'

  return (
    <>
      <button
        type="button"
        ref={knopf}
        onClick={oeffnen}
        aria-expanded={offen}
        aria-label={t('sprung.oeffnen')}
        title={t('sprung.oeffnen')}
        className="cursor-pointer rounded-lg px-2 py-1.5 transition hover:bg-slate-200/60 dark:hover:bg-white/10"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 10h18" />
        </svg>
      </button>
      {offen &&
        pos &&
        createPortal(
          <>
            <span className="fixed inset-0 z-40" onClick={() => setOffen(false)} />
            <div
              role="dialog"
              aria-label={t('sprung.oeffnen')}
              className="fixed z-50 w-[280px] rounded-xl border border-slate-200 bg-white p-3 text-slate-800 shadow-xl dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
              style={{ top: pos.top, left: pos.left }}
            >
              <div className="mb-2 flex items-center justify-between">
                {monat === null ? (
                  <>
                    <button type="button" className={kopfKnopf} disabled={jahr <= minJahr} onClick={() => setJahr(jahr - 1)} aria-label={t('nav.back')}>
                      ←
                    </button>
                    <span className="text-sm font-semibold tabular-nums">{jahr}</span>
                    <button type="button" className={kopfKnopf} disabled={jahr >= maxJahr} onClick={() => setJahr(jahr + 1)} aria-label={t('nav.forward')}>
                      →
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className={kopfKnopf} onClick={() => setMonat(null)}>
                      ← {jahr}
                    </button>
                    <span className="text-sm font-semibold">{monthName(monat)}</span>
                    <button type="button" className={kopfKnopf} onClick={() => springe(`${monatKey(monat)}-01`)}>
                      {t('sprung.ganzerMonat')}
                    </button>
                  </>
                )}
              </div>
              {inhalt}
              <div className="mt-3 flex items-center justify-between gap-1 border-t border-slate-200 pt-2 text-[11px] dark:border-white/10">
                <button type="button" className={kopfKnopf + ' text-[11px]'} onClick={() => springe(von)} title={t('sprung.ersterTitel')}>
                  ⇤ {formatDate(von)}
                </button>
                <button type="button" className={kopfKnopf + ' text-[11px] font-medium'} onClick={() => springe(heute)}>
                  {t('nav.today')}
                </button>
                <button type="button" className={kopfKnopf + ' text-[11px]'} onClick={() => springe(bis)} title={t('sprung.letzterTitel')}>
                  {formatDate(bis)} ⇥
                </button>
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  )
}
