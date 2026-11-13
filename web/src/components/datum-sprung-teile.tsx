/** Teile des Datumssprungs: Kopf, Monats- und Tagesraster, Fußzeile. */
import { monthName } from '@shared/time.ts'
import type { Dispatch, SetStateAction } from 'react'
import type { Translate } from '../lib/i18n.tsx'
import { formatDate } from '@shared/time.ts'

export function SprungFuss({ kopfKnopf, springe, von, t, heute, bis }: {
  kopfKnopf: 'cursor-pointer rounded-md px-2 py-1 text-sm transition hover:bg-ak-flaeche-2 disabled:cursor-default disabled:opacity-45'
  springe: (d: string) => void
  von: string
  t: Translate
  heute: string
  bis: string
}) {
  return (
    <>
      <button type="button" className={kopfKnopf + ' text-[11px]'} onClick={() => springe(von)} title={t('sprung.ersterTitel')}>
        ⇤ {formatDate(von)}
      </button>
      <button type="button" className={kopfKnopf + ' text-[11px] font-medium'} onClick={() => springe(heute)}>
        {t('nav.today')}
      </button>
      <button type="button" className={kopfKnopf + ' text-[11px]'} onClick={() => springe(bis)} title={t('sprung.letzterTitel')}>
        {formatDate(bis)} ⇥
      </button>
    </>
  )
}

export function SprungKopf({ monat, kopfKnopf, jahr, minJahr, setJahr, t, maxJahr, setMonat, springe, monatKey }: {
  monat: number | null
  kopfKnopf: 'cursor-pointer rounded-md px-2 py-1 text-sm transition hover:bg-ak-flaeche-2 disabled:cursor-default disabled:opacity-45'
  jahr: number
  minJahr: number
  setJahr: Dispatch<SetStateAction<number>>
  t: Translate
  maxJahr: number
  setMonat: Dispatch<SetStateAction<number | null>>
  springe: (d: string) => void
  monatKey: (m: number) => string
}) {
  return (
    <>
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
    </>
  )
}

export function TageRaster({ versatz, tage, monatKey, monat, jeTag, von, bis, springe, t, date, heute }: {
  versatz: number
  tage: number
  monatKey: (m: number) => string
  monat: number
  jeTag: Map<string, number>
  von: string
  bis: string
  springe: (d: string) => void
  t: Translate
  date: string
  heute: string
}) {
  return (
    <>
      {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((w) => (
        <span key={w} className="py-1 text-[10px] font-semibold uppercase text-ak-leise">
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
            aria-label={n ? `${i + 1}. · ${t('sprung.termine', { n })}` : undefined}
            className={[
              'relative cursor-pointer rounded-md py-1.5 text-xs tabular-nums transition disabled:cursor-default disabled:opacity-45',
              d === date ? 'bg-ak-gewaehlt font-bold text-ak-auf-gewaehlt' : 'hover:bg-ak-flaeche-2',
              d === heute ? 'ring-1 ring-ak-akzent' : '',
            ].join(' ')}
          >
            {i + 1}
            {n > 0 && <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-ak-akzent" />}
          </button>
        )
      })}
    </>
  )
}

export function MonatsRaster({ monatKey, jeMonat, date, monatErlaubt, setMonat, zelle, heute }: {
  monatKey: (m: number) => string
  jeMonat: Map<string, number>
  date: string
  monatErlaubt: (m: number) => boolean
  setMonat: Dispatch<SetStateAction<number | null>>
  zelle: 'flex cursor-pointer flex-col items-center justify-center rounded-lg py-1.5 text-xs transition disabled:cursor-default disabled:opacity-45'
  heute: string
}) {
  return (
    <>
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
              aktiv ? 'bg-ak-gewaehlt font-bold text-ak-auf-gewaehlt' : 'font-medium hover:bg-ak-flaeche-2',
              key === heute.slice(0, 7) ? 'ring-1 ring-ak-akzent' : '',
            ].join(' ')}
          >
            <span>{monthName(m).slice(0, 3)}</span>
            <span className="tabular-nums text-[10px] opacity-70">{n ? n : '–'}</span>
          </button>
        )
      })}
    </>
  )
}
