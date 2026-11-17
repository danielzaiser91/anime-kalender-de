import { Chip } from '../ui.tsx'
import { WERTUNG_STUFEN, wertungText } from '../../lib/filter-wertung.ts'
import type { FilterState } from '../../lib/filters.ts'
import type { Translate } from '../../lib/i18n.tsx'

/** Die Beschriftungen der Gruppe — auch die Filtersuche prüft sie. */
export function wertungTexte(t: Translate): string[] {
  return [t('filter.wertung.alle'), ...WERTUNG_STUFEN.map((s) => t('filter.wertung.ab', { n: wertungText(s) })), t('filter.wertung.ohneAus')]
}

/**
 * **Wertung**: „alle“ (keine Schwelle) und vier Mindestwertungen wie bei der Belegstärke, darunter das Kästchen
 * „Titel ohne Wertung ausschließen“. Aus: Titel ohne Wertung bleiben auch bei gewählter Schwelle sichtbar.
 */
export function WertungInhalt({ t, filters, set }: { t: Translate; filters: FilterState; set: (patch: Partial<FilterState>) => void }) {
  return (
    <>
      <Chip active={filters.minScore === 0} onClick={() => set({ minScore: 0 })}>
        {t('filter.wertung.alle')}
      </Chip>
      {WERTUNG_STUFEN.map((s) => (
        <Chip key={s} active={filters.minScore === s} onClick={() => set({ minScore: s })}>
          {t('filter.wertung.ab', { n: wertungText(s) })}
        </Chip>
      ))}
      <label className="flex min-h-11 w-full cursor-pointer items-center gap-2 text-xs font-semibold text-ak-text">
        <input
          type="checkbox"
          checked={filters.ohneWertungAus}
          onChange={(e) => set({ ohneWertungAus: e.target.checked })}
          className="size-4 shrink-0 accent-ak-akzent"
        />
        {t('filter.wertung.ohneAus')}
      </label>
    </>
  )
}

/** Die aktiven Wertungsfilter als Einträge der Leiste „aktive Filter“. */
export function wertungEintraege(t: Translate, f: FilterState, aus: (patch: Partial<FilterState>) => () => void): { label: string; weg: () => void }[] {
  const liste: { label: string; weg: () => void }[] = []
  if (f.minScore > 0) liste.push({ label: t('filter.wertung.aktiv', { n: wertungText(f.minScore) }), weg: aus({ minScore: 0 }) })
  if (f.ohneWertungAus) liste.push({ label: t('filter.wertung.ohneAusAktiv'), weg: aus({ ohneWertungAus: false }) })
  return liste
}
