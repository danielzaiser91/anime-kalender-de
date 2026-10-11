import type { ReactNode } from 'react'
import type { Translate } from '../lib/i18n.tsx'
import type { FilterState } from '../lib/filters.ts'
import { schnellSetzen, schnellZustand, type SchnellId, type SchnellZiel } from '../lib/schnellfilter.ts'
import { TvZeichen, DiscZeichen } from './ui.tsx'
import { TIPPFLAECHE_HOCH } from './detail/tippziel.ts'
import { PILLE_JA, PILLE_NEIN } from './filter/pille-zustand.ts'

export interface SchnellEintrag {
  id: SchnellId
  text: string
  zeichen: ReactNode
}

/** Die Schnellfilter in Reihenfolge des Fensters; TV nur im Kalender, „verfügbar" nur mit Belegstärke. */
export function schnellListe(t: Translate, showConfidence: boolean, mitTv: boolean): SchnellEintrag[] {
  return [
    { id: 'favoriten', text: t('filter.schnell.favoriten'), zeichen: '★' },
    { id: 'cartoon', text: t('filter.schnell.cartoon'), zeichen: '🎨' },
    { id: 'kostenlos', text: t('filter.schnell.kostenlos'), zeichen: '🆓' },
    ...(mitTv ? [{ id: 'tv' as const, text: t('filter.schnell.tv'), zeichen: <TvZeichen className="size-3 opacity-80" /> }] : []),
    { id: 'disc', text: t('filter.schnell.disc'), zeichen: <DiscZeichen className="size-3 opacity-80" /> },
    { id: 'bestaetigt', text: t('filter.schnell.bestaetigt'), zeichen: '✓' },
    ...(showConfidence ? [{ id: 'verfuegbar' as const, text: t('filter.schnell.verfuegbar'), zeichen: '▶' }] : []),
    ...(mitTv ? [{ id: 'zweitanbieter' as const, text: t('filter.schnell.zweitanbieter'), zeichen: '↪' }] : []),
  ]
}

/** Setzt einen Schnellfilter; nur TV ändert zusätzlich den Schalter der Ansicht. */
export function schnellAnwenden(
  filters: FilterState,
  id: SchnellId,
  ziel: SchnellZiel,
  tvAn: boolean | undefined,
  onChange: (next: FilterState) => void,
  setTvAn?: (an: boolean) => void,
): void {
  const r = schnellSetzen(filters, id, ziel, tvAn)
  onChange(r.filters)
  if (id === 'tv' && r.tvAn !== undefined && r.tvAn !== tvAn) setTvAn?.(r.tvAn)
}

/** Stil der Chips je Zustand; gewählt und ausgeschlossen kommen aus `pille-zustand.ts`. */
const STIL = {
  aus: 'border-ak-rand bg-ak-flaeche text-ak-text',
  ja: PILLE_JA,
  nein: PILLE_NEIN,
}

/**
 * **Die Schnellfilter als Chips** (Filterfenster-Entwurf, 09.10.2026): Aussehen wie die Filter-Pille der App, 32 px hoch,
 * Trefferfläche 44 px. Der Zustand steht in Farbe **und** Zeichen (✓ gewählt, ⊘ ausgeschlossen, durchgestrichen).
 * Das Ziel eines Tipps gibt der Klick-Modus vor; ein zweiter Tipp mit gleichem Ziel hebt auf (`schnellSetzen`).
 */
export function SchnellChips({
  t,
  filters,
  onChange,
  mode,
  favoriteCount,
  showConfidence,
  tvAn,
  setTvAn,
  zeige,
}: {
  t: Translate
  filters: FilterState
  onChange: (next: FilterState) => void
  mode: 'include' | 'exclude'
  favoriteCount?: number
  showConfidence: boolean
  tvAn?: boolean
  setTvAn?: (an: boolean) => void
  /** Filtert Chips nach der Filtersuche (`zeigePille`). */
  zeige: (text: string) => boolean
}) {
  const ziel: SchnellZiel = mode === 'include' ? 'ja' : 'nein'
  const aktion = t(ziel === 'ja' ? 'filter.schnell.ja' : 'filter.schnell.nein')
  return (
    <>
      {schnellListe(t, showConfidence, !!setTvAn)
        .filter((k) => zeige(k.text) && (k.id !== 'zweitanbieter' || ziel === 'nein'))
        .map((k) => {
          const z = schnellZustand(filters, k.id, tvAn)
          return (
            <button
              key={k.id}
              type="button"
              aria-pressed={z === 'ja' ? true : z === 'nein' ? 'mixed' : false}
              aria-label={`${k.text}: ${aktion}`}
              onClick={() => schnellAnwenden(filters, k.id, ziel, tvAn, onChange, setTvAn)}
              className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold whitespace-nowrap transition ${TIPPFLAECHE_HOCH} ${STIL[z ?? 'aus']}`}
            >
              <span aria-hidden="true" className="text-xs">{z === 'ja' ? '✓' : z === 'nein' ? '⊘' : k.zeichen}</span>
              {k.text}
              {k.id === 'favoriten' && favoriteCount ? <span className="font-normal opacity-60">({favoriteCount})</span> : null}
            </button>
          )
        })}
    </>
  )
}
