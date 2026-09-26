import { useState } from 'react'
import type React from 'react'
import type { ReleaseEvent } from '@shared/types.ts'
import { useLang } from '../lib/i18n.tsx'

/**
 * Ein Bündel aus `buendeleTermine()`: die erste Karte, darunter der Zähler als Aufklapper — inline,
 * nicht als Popover (docs/wissen/datensatz.md, „Eine Liste wird nach Entitäten gebündelt").
 * Liegt das Sprungziel eingeklappt, trägt die erste Karte den Anker.
 */
export function TerminBuendel({
  termine,
  ankerId,
  karte,
}: {
  termine: ReleaseEvent[]
  ankerId?: string
  karte: (ev: ReleaseEvent, anker: boolean) => React.ReactNode
}) {
  const { t } = useLang()
  const [offen, setOffen] = useState(false)
  const [erster, ...weitere] = termine
  if (!weitere.length) return karte(erster, erster.id === ankerId)
  const ankerEingeklappt = !offen && termine.some((e) => e.id === ankerId)
  const letzteZeit = weitere[weitere.length - 1].time
  return (
    <>
      {karte(erster, erster.id === ankerId || ankerEingeklappt)}
      <button
        type="button"
        onClick={() => setOffen(!offen)}
        aria-expanded={offen}
        className="-mt-0.5 ml-2 flex cursor-pointer items-center gap-1 self-start rounded-md px-1.5 py-0.5 text-[11px] font-medium text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-100"
      >
        <span aria-hidden="true">{offen ? '▴' : '▾'}</span>
        {offen
          ? t('week.buendelZu')
          : letzteZeit
            ? t('week.buendel', { n: weitere.length, zeit: letzteZeit })
            : t('week.buendelOhneZeit', { n: weitere.length })}
      </button>
      {offen && weitere.map((ev) => karte(ev, ev.id === ankerId))}
    </>
  )
}
