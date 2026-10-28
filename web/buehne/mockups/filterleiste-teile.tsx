import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { activeFilterCount } from '../../src/lib/filters.ts'
import { useLang } from '../../src/lib/i18n.tsx'
import { FilterBar, type FilterBarProps } from '../../src/components/FilterBar.tsx'
import { FilterDetailsFeld } from '../../src/components/FilterDetails.tsx'
import { AktiveFilter } from '../../src/components/kalender/AktiveFilter.tsx'

const SCHWELLE = 8

/**
 * Weg beim Abwärtsscrollen, zurück beim Aufwärtsscrollen — dieselbe Regel wie die Kopfleiste (`lib/use-einrollen.ts`),
 * nur ohne die Nutzer-Sperre. Oben auf der Seite bleibt die Leiste da. `erzwungen` zeigt den ausgeblendeten Zustand
 * ohne Scrollen (die Bühne nimmt ihre Bilder oben auf).
 */
export function useLeisteWeg(erzwungen: boolean): boolean {
  const [weg, setWeg] = useState(erzwungen)
  useEffect(() => {
    if (erzwungen) return
    let letzte = window.scrollY
    let summe = 0
    const scroll = () => {
      const y = window.scrollY
      const dy = y - letzte
      letzte = y
      if (y < 80) {
        setWeg(false)
        summe = 0
        return
      }
      summe = Math.sign(dy) === Math.sign(summe) ? summe + dy : dy
      if (summe >= SCHWELLE) setWeg(true)
      else if (summe <= -SCHWELLE) setWeg(false)
    }
    window.addEventListener('scroll', scroll, { passive: true })
    return () => window.removeEventListener('scroll', scroll)
  }, [erzwungen])
  return weg
}

/** Der Knopf „Filter 1 ▾“ wie in `FilterBar.tsx`. */
export function FilterKnopf({ count, open, onClick }: { count: number; open: boolean; onClick: () => void }) {
  const { t } = useLang()
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className="ml-auto inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-ak-rand px-3 py-1.5 text-sm font-semibold text-ak-text transition hover:bg-ak-flaeche-2"
    >
      {t('filter.button')}
      {count > 0 && <span className="rounded-full bg-ak-akzent px-1.5 text-[11px] font-bold text-ak-auf-akzent">{count}</span>}
      <span aria-hidden="true" className={open ? 'rotate-180 transition' : 'transition'}>
        ▾
      </span>
    </button>
  )
}

/** Lage des Docks wie in `FilterBarDock` (unten, mittig, Höhe begrenzt); `schmal` = nur so breit wie der Inhalt, rechts. */
function dockKlassen(schmal: boolean, weg = false): string {
  return [
    'fixed inset-x-2 bottom-[calc(0.25rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-h-[calc(100dvh-5.5rem-env(safe-area-inset-bottom)-77px)] flex-col max-w-[1180px] transition-transform duration-300',
    schmal && 'right-2 left-auto mx-0 w-max max-w-[calc(100vw-1rem)] md:right-4 md:max-w-[calc(100vw-2rem)]',
    weg && 'translate-y-[calc(100%+1rem)]',
  ]
    .filter(Boolean)
    .join(' ')
}

/** Variante A: unten nur die Pille „Filter 1 ▾“; die Chips und das Feld erscheinen erst beim Aufklappen darüber. */
export function DockPille(p: FilterBarProps) {
  const [open, setOpen] = useState(false)
  const count = activeFilterCount(p.filters)
  return (
    <div className={dockKlassen(!open)}>
      <div className={open ? 'flex min-h-0 flex-col overflow-hidden rounded-2xl border border-ak-rand bg-ak-flaeche shadow-[0_12px_32px_rgba(0,0,0,.18)] md:w-[min(720px,calc(100vw-2rem))]' : 'flex min-h-0 flex-col overflow-hidden rounded-2xl border border-ak-rand bg-ak-flaeche shadow-[0_12px_32px_rgba(0,0,0,.18)]'}>
        {open && (
          <div className="flex min-h-0 flex-1 flex-col animate-fade-in border-b border-ak-linie">
            <FilterDetailsFeld meta={p.meta} filters={p.filters} onChange={p.onChange} showConfidence={p.showConfidence} favoriteCount={p.favoriteCount} />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 p-1.5">
          {open && (
            <div className="max-h-[5.5rem] min-w-0 flex-1 overflow-y-auto">
              <AktiveFilter filters={p.filters} onChange={p.onChange} />
            </div>
          )}
          <FilterKnopf count={count} open={open} onClick={() => setOpen(!open)} />
        </div>
      </div>
    </div>
  )
}

/** Variante B (Rechner): das echte Dock, das beim Abwärtsscrollen nach unten wegrollt und beim Aufwärtsscrollen zurückkommt. */
export function DockEinrollend({ erzwungen, ...p }: FilterBarProps & { erzwungen: boolean }) {
  const [open, setOpen] = useState(false)
  const weg = useLeisteWeg(erzwungen) && !open
  const pille = !open && activeFilterCount(p.filters) === 0
  return (
    <div className={dockKlassen(pille, weg)}>
      <FilterBar {...p} pille={pille} open={open} setOpen={setOpen} />
    </div>
  )
}

/** Variante B (Handy): die Werkzeugleiste (gleiche Klassen wie `Werkzeugleiste.tsx`) rollt mit nach unten weg. */
export function LeisteEinrollend({ erzwungen, children }: { erzwungen: boolean; children: ReactNode }) {
  const { t } = useLang()
  const weg = useLeisteWeg(erzwungen)
  return createPortal(
    <div
      role="toolbar"
      aria-label={t('filter.button')}
      className={[
        'fixed inset-x-0 bottom-0 z-30 box-content flex h-12 items-center gap-2 max-[359px]:gap-1 border-t border-ak-rand bg-ak-flaeche pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] md:hidden transition-transform duration-300',
        weg && 'translate-y-full',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>,
    document.body,
  )
}
