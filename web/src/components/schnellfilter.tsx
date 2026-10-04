import type { ReactNode } from 'react'
import type { Translate } from '../lib/i18n.tsx'
import type { FilterState } from '../lib/filters.ts'
import { schnellSetzen, schnellZustand, type SchnellId, type SchnellZiel } from '../lib/schnellfilter.ts'
import { Tooltip, TvZeichen, DiscZeichen } from './ui.tsx'

/**
 * **Die Schnellfilter als Karten mit zwei Stellungen** (Daniel, 04.10.2026): oben der kurze Name, darunter eine
 * Zeile über die ganze Breite der Karte, in der Mitte geteilt — links ✅ (nur anzeigen), rechts 🚫 (ausblenden).
 * Höchstens eines von beiden ist aktiv; die Logik steht in `lib/schnellfilter.ts`.
 */
export function SchnellKarten({
  t,
  filters,
  onChange,
  favoriteCount,
  showConfidence,
  tvAn,
  setTvAn,
  zeige,
}: {
  t: Translate
  filters: FilterState
  onChange: (next: FilterState) => void
  favoriteCount?: number
  showConfidence: boolean
  tvAn?: boolean
  setTvAn?: (an: boolean) => void
  /** Filtert Karten nach der Filtersuche (`zeigePille`). */
  zeige: (text: string) => boolean
}) {
  const karten: { id: SchnellId; text: string; zeichen: ReactNode }[] = [
    { id: 'favoriten', text: t('filter.schnell.favoriten'), zeichen: '★' },
    { id: 'kostenlos', text: t('filter.schnell.kostenlos'), zeichen: '🆓' },
    { id: 'bestaetigt', text: t('filter.schnell.bestaetigt'), zeichen: '✓' },
    ...(setTvAn ? [{ id: 'tv' as const, text: t('filter.schnell.tv'), zeichen: <TvZeichen className="size-3 opacity-80" /> }] : []),
    { id: 'disc', text: t('filter.schnell.disc'), zeichen: <DiscZeichen className="size-3 opacity-80" /> },
    ...(showConfidence ? [{ id: 'verfuegbar' as const, text: t('filter.schnell.verfuegbar'), zeichen: '▶' }] : []),
    { id: 'cartoon', text: t('filter.schnell.cartoon'), zeichen: '🎨' },
  ]
  const setzen = (id: SchnellId, ziel: SchnellZiel) => {
    const r = schnellSetzen(filters, id, ziel, tvAn)
    onChange(r.filters)
    if (id === 'tv' && r.tvAn !== undefined && r.tvAn !== tvAn) setTvAn?.(r.tvAn)
  }
  return (
    <>
      {karten
        .filter((k) => zeige(k.text))
        .map((k) => {
          const z = schnellZustand(filters, k.id, tvAn)
          const knopf = (ziel: SchnellZiel, symbol: string, aktiv: string) => (
            <Tooltip text={t(ziel === 'ja' ? 'filter.schnell.ja' : 'filter.schnell.nein')} eigenerFokus className="flex">
              <button
                type="button"
                aria-pressed={z === ziel}
                aria-label={`${k.text}: ${t(ziel === 'ja' ? 'filter.schnell.ja' : 'filter.schnell.nein')}`}
                onClick={() => setzen(k.id, ziel)}
                className={`flex-1 cursor-pointer py-1 text-sm leading-none transition ${z === ziel ? aktiv : 'hover:bg-ak-flaeche-2'}`}
              >
                {symbol}
              </button>
            </Tooltip>
          )
          return (
            <div key={k.id} className="inline-flex min-w-[5.5rem] flex-col overflow-hidden rounded-xl border border-ak-rand bg-ak-flaeche text-sm">
              <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 font-semibold text-ak-text">
                <span aria-hidden="true">{k.zeichen}</span>
                {k.text}
                {k.id === 'favoriten' && favoriteCount ? <span className="font-normal opacity-60">({favoriteCount})</span> : null}
              </div>
              <div className="grid grid-cols-2 divide-x divide-ak-rand border-t border-ak-rand">
                {knopf('ja', '✅', 'bg-emerald-500/25')}
                {knopf('nein', '🚫', 'bg-rose-500/25')}
              </div>
            </div>
          )
        })}
    </>
  )
}
