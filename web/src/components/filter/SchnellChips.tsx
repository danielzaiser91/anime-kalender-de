import { useLang } from '../../lib/i18n.tsx'
import type { FilterState } from '../../lib/filters.ts'
import { schnellZustand, type SchnellId, type SchnellZiel } from '../../lib/schnellfilter.ts'
import { schnellAnwenden, schnellListe } from '../schnellfilter.tsx'

const REIHENFOLGE: SchnellId[] = ['favoriten', 'cartoon', 'kostenlos', 'tv', 'disc', 'bestaetigt', 'verfuegbar']

/**
 * Die Schnellfilter als Chips in einer rollbaren Reihe. Ein Tipp schaltet weiter: aus → nur anzeigen → ausblenden → aus.
 * Der Zustand steht im Namen für Vorlesende und als Zeichen (✓ / durchgestrichen) für alle, nicht nur in der Farbe.
 */
export function SchnellChips({ filters, onChange, tvAn, setTvAn }: {
  filters: FilterState
  onChange: (next: FilterState) => void
  tvAn?: boolean
  setTvAn?: (an: boolean) => void
}) {
  const { t } = useLang()
  const liste = schnellListe(t, true, !!setTvAn)
  const eintraege = REIHENFOLGE.map((id) => liste.find((e) => e.id === id)).filter((e) => e !== undefined)
  return (
    <div role="group" aria-label={t('filter.schnellGruppe')} className="flex items-center gap-1.5">
      {eintraege.map((e) => {
        const z = schnellZustand(filters, e.id, tvAn)
        // aus → ja → nein → aus: „nein" mit demselben Ziel nochmal hebt es auf.
        const ziel: SchnellZiel = z === undefined ? 'ja' : 'nein'
        const zustandText = z === 'ja' ? t('filter.zustand.ja') : z === 'nein' ? t('filter.zustand.nein') : t('filter.zustand.aus')
        return (
          <button
            key={e.id}
            type="button"
            aria-label={`${e.text}: ${zustandText}`}
            aria-pressed={z === 'ja' ? true : z === 'nein' ? 'mixed' : false}
            onClick={() => schnellAnwenden(filters, e.id, ziel, tvAn, onChange, setTvAn)}
            className={[
              'flex h-11 shrink-0 cursor-pointer items-center gap-1 rounded-full border px-3 text-[13px] font-semibold whitespace-nowrap transition',
              z === 'ja' ? 'border-transparent bg-emerald-500 text-emerald-950' : '',
              z === 'nein' ? 'border-dashed border-rose-400/70 bg-rose-500/10 text-rose-600 line-through dark:text-rose-300' : '',
              z ? '' : 'border-ak-rand bg-ak-flaeche text-ak-text',
            ].join(' ')}
          >
            {z === 'ja' ? <span aria-hidden="true">✓</span> : z === 'nein' ? <span aria-hidden="true">⊘</span> : <span aria-hidden="true">{e.zeichen}</span>}
            {e.text}
          </button>
        )
      })}
    </div>
  )
}
