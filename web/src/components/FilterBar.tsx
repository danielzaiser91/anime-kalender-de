import { useEffect, useRef, useState, type RefObject } from 'react'
import type { DataMeta } from '@shared/types.ts'
import { activeFilterCount, type FilterState } from '../lib/filters.ts'
import { useLang } from '../lib/i18n.tsx'
import { FilterDetailsFeld } from './FilterDetails.tsx'
import { AktiveFilter } from './kalender/AktiveFilter.tsx'

/**
 * Die Filterleiste der Datenbank.
 *
 * **Dieselbe Ansicht wie im Kalender**: Der Zustandsstreifen
 * steht sichtbar über dem Knopf, und das Feld öffnet genau die Filter, die auch
 * Woche und Monat zeigen — Klick-Modus in eigener Zeile, betroffene Filter im
 * Kasten, der Rest hinter „mehr Filter". Gesucht wird seit dem 26.09.2026 im
 * Kopf der Seite.
 */
export type FilterBarProps = {
  meta: DataMeta
  filters: FilterState
  onChange: (next: FilterState) => void
  showConfidence: boolean
  favoriteCount: number
}

/**
 * **Derselbe Kasten, unten angedockt**. Vorher stand die Leiste oben im Fluss der Titelliste und
 * war beim Scrollen
 * weg. Platz für die letzten Kacheln lässt die Fußzeile (kein Leerraum oben, 04.10.2026).
 *
 * **Zugeklappt immer nur der Knopf**, rechts unten: Chips und „Alle zurücksetzen" verdeckten sonst
 * eine Kachelreihe (62 × 1180 px). Sie erscheinen mit dem Feld beim Aufklappen darüber. Das Dock
 * hängt in beiden Zuständen an derselben rechten unteren Ecke, der Knopf springt nicht (29.10.2026).
 */
export function FilterBarDock(props: FilterBarProps) {
  const [open, setOpen] = useState(false)
  const knopf = useRef<HTMLButtonElement>(null)
  useEscapeZu(open, () => {
    setOpen(false)
    knopf.current?.focus()
  })
  return (
    <div className="fixed right-2 bottom-[calc(0.25rem+env(safe-area-inset-bottom))] z-30 flex w-max max-w-[calc(100vw-1rem)] max-h-[calc(100dvh-5.5rem-env(safe-area-inset-bottom)-77px)] flex-col md:right-4 md:max-w-[calc(100vw-2rem)]">
      <FilterBar {...props} pille open={open} setOpen={setOpen} knopfRef={knopf} />
    </div>
  )
}

/** Escape schließt das offene Feld (Tastatur); der Aufrufer gibt den Fokus an den Knopf zurück. */
function useEscapeZu(offen: boolean, zu: () => void) {
  const aktuell = useRef(zu)
  aktuell.current = zu
  useEffect(() => {
    if (!offen) return
    const taste = (e: KeyboardEvent) => e.key === 'Escape' && aktuell.current()
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [offen])
}

export function FilterBar({
  meta,
  filters,
  onChange,
  showConfidence,
  favoriteCount,
  pille,
  open,
  setOpen,
  knopfRef,
}: FilterBarProps & { pille?: boolean; open: boolean; setOpen: (next: boolean) => void; knopfRef?: RefObject<HTMLButtonElement | null> }) {
  const { t } = useLang()
  const count = activeFilterCount(filters)

  return (
    <div className={pille && open ? 'flex min-h-0 flex-col overflow-hidden rounded-2xl border border-ak-rand bg-ak-flaeche md:w-[min(720px,calc(100vw-2rem))]' : 'flex min-h-0 flex-col overflow-hidden rounded-2xl border border-ak-rand bg-ak-flaeche shadow-[0_12px_32px_rgba(0,0,0,.18)]'}>
      {/* Die Leiste bleibt an ihrer Stelle, der Inhalt klappt darüber auf (Daniel, 04.10.2026). */}
      {open && (
        <div className="flex min-h-0 flex-1 flex-col animate-fade-in border-b border-ak-linie">
          <FilterDetailsFeld
            meta={meta}
            filters={filters}
            onChange={onChange}
            showConfidence={showConfidence}
            favoriteCount={favoriteCount}
          />
        </div>
      )}
      {/* Auswahl links, Filter-Knopf rechts auf derselben Zeile. */}
      <div className="flex flex-wrap items-end gap-2 p-1.5">
        {(open || !pille) && (
          <div className="max-h-[5.5rem] min-w-0 flex-1 overflow-y-auto">
            <AktiveFilter filters={filters} onChange={onChange} />
          </div>
        )}
        <button
          ref={knopfRef}
          data-filter-knopf
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="ml-auto inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-ak-rand px-3 py-1.5 text-sm font-semibold text-ak-text transition hover:bg-ak-flaeche-2"
        >
          {t('filter.button')}
          {count > 0 && <span className="rounded-full bg-ak-akzent px-1.5 text-[11px] font-bold text-ak-auf-akzent">{count}</span>}
          <span aria-hidden="true" className={open ? 'rotate-180 transition' : 'transition'}>
            ▾
          </span>
        </button>
      </div>

    </div>
  )
}
