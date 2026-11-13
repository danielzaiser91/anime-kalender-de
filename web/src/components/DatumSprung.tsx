import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { todayIso, weekdayIndex } from '@shared/time.ts'
import { useEscape } from '../lib/escape.ts'
import { useLang } from '../lib/i18n.tsx'
import { sprungLage, type SprungLage } from '../lib/sprung-lage.ts'
import { sichtbareBreite } from '../lib/sichtbare-breite.ts'
import { Tooltip } from './ui.tsx'
import { SprungFuss } from './datum-sprung-teile.tsx'
import { SprungKopf } from './datum-sprung-teile.tsx'
import { TageRaster } from './datum-sprung-teile.tsx'
import { MonatsRaster } from './datum-sprung-teile.tsx'

/**
 * **Sprung zu einem Datum**.
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
  const [pos, setPos] = useState<SprungLage | null>(null)

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
    const weg = () => setOffen(false)
    window.addEventListener('resize', weg)
    return () => window.removeEventListener('resize', weg)
  }, [offen])
  useEscape(offen, () => setOffen(false))

  const oeffnen = () => {
    if (offen) return setOffen(false)
    const r = knopf.current?.getBoundingClientRect()
    if (r) setPos(sprungLage(r, { breite: sichtbareBreite(), hoehe: window.innerHeight }))
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
    'flex cursor-pointer flex-col items-center justify-center rounded-lg py-1.5 text-xs transition disabled:cursor-default disabled:opacity-45'

  let inhalt: ReactNode
  if (monat === null) {
    inhalt = (
      <div className="grid grid-cols-3 gap-1">
        <MonatsRaster
          monatKey={monatKey}
          jeMonat={jeMonat}
          date={date}
          monatErlaubt={monatErlaubt}
          setMonat={setMonat}
          zelle={zelle}
          heute={heute}
        />
      </div>
    )
  } else {
    const erster = `${monatKey(monat)}-01`
    const tage = new Date(jahr, monat + 1, 0).getDate()
    const versatz = weekdayIndex(erster)
    inhalt = (
      <div className="grid grid-cols-7 gap-0.5 text-center">
        <TageRaster
          versatz={versatz}
          tage={tage}
          monatKey={monatKey}
          monat={monat}
          jeTag={jeTag}
          von={von}
          bis={bis}
          springe={springe}
          t={t}
          date={date}
          heute={heute}
        />
      </div>
    )
  }

  const kopfKnopf =
    'cursor-pointer rounded-md px-2 py-1 text-sm transition hover:bg-ak-flaeche-2 disabled:cursor-default disabled:opacity-45'

  return (
    <>
      <Tooltip text={t('sprung.oeffnen')} seite="oben" eigenerFokus>
        <button
          type="button"
          ref={knopf}
          onClick={oeffnen}
          aria-expanded={offen}
          aria-label={t('sprung.oeffnen')}
          className="flex size-11 cursor-pointer items-center justify-center rounded-full border border-ak-rand bg-ak-flaeche text-ak-text transition hover:border-ak-leise"
        >
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M8 3v4M16 3v4M3 10h18" />
          </svg>
        </button>
      </Tooltip>
      {offen &&
        pos &&
        createPortal(
          <>
            <span className="fixed inset-0 z-40" onClick={() => setOffen(false)} />
            <div
              role="dialog"
              aria-label={t('sprung.oeffnen')}
              className="fixed z-50 w-[280px] overflow-y-auto rounded-2xl border border-ak-rand bg-ak-flaeche p-3 text-ak-text shadow-xl"
              style={{ top: pos.top, bottom: pos.bottom, left: pos.left, maxHeight: pos.maxHoehe }}
            >
              <div className="mb-2 flex items-center justify-between">
                <SprungKopf
                  monat={monat}
                  kopfKnopf={kopfKnopf}
                  jahr={jahr}
                  minJahr={minJahr}
                  setJahr={setJahr}
                  t={t}
                  maxJahr={maxJahr}
                  setMonat={setMonat}
                  springe={springe}
                  monatKey={monatKey}
                />
              </div>
              {inhalt}
              <div className="mt-3 flex items-center justify-between gap-1 border-t border-ak-linie pt-2 text-[11px]">
                <SprungFuss kopfKnopf={kopfKnopf} springe={springe} von={von} t={t} heute={heute} bis={bis} />
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  )
}
