import { useState, type ReactNode } from 'react'
import { activeFilterCount } from '../../src/lib/filters.ts'
import { useMobil } from '../../src/lib/use-mobil.ts'
import { DbKopfbereich as EchterKopf, type DbKopfProps } from '../../src/components/filter/DbWerkzeug.tsx'
import type { FilterBarProps } from '../../src/components/FilterBar.tsx'
import { FilterDetailsFeld } from '../../src/components/FilterDetails.tsx'
import { AktiveFilter } from '../../src/components/kalender/AktiveFilter.tsx'
import { mockup } from '../register.ts'
import { DockEinrollend, DockPille, FilterKnopf, LeisteEinrollend } from './filterleiste-teile.tsx'

/**
 * Variante C (Rechner): die Chips und der Filter-Knopf stehen oben unter den Schaltern, das Feld klappt darunter auf;
 * unten schwebt nichts mehr. Am Handy bleibt alles wie es ist: die Werkzeugleiste gehört auch dem Kalender und der Daumenreichweite.
 */
function KopfMitChips(p: DbKopfProps) {
  const mobil = useMobil()
  const [open, setOpen] = useState(false)
  if (mobil) return <EchterKopf {...p} />
  return (
    <>
      <EchterKopf {...p} />
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-ak-rand bg-ak-flaeche p-1.5">
        <div className="min-w-0 flex-1">
          <AktiveFilter filters={p.filters} onChange={p.onFiltersChange} />
        </div>
        <FilterKnopf count={activeFilterCount(p.filters)} open={open} onClick={() => setOpen(!open)} />
        {open && (
          <div className="flex max-h-[60vh] basis-full flex-col overflow-hidden border-t border-ak-linie">
            <FilterDetailsFeld meta={p.meta} filters={p.filters} onChange={p.onFiltersChange} showConfidence favoriteCount={p.favoriteCount} />
          </div>
        )}
      </div>
    </>
  )
}

/** Variante C: unten nichts. */
function KeinDock(_p: FilterBarProps) {
  return null
}

const DockWeg = (p: FilterBarProps) => <DockEinrollend {...p} erzwungen />
const DockRollt = (p: FilterBarProps) => <DockEinrollend {...p} erzwungen={false} />
const LeisteWeg = ({ children }: { children: ReactNode }) => <LeisteEinrollend erzwungen>{children}</LeisteEinrollend>
const LeisteRollt = ({ children }: { children: ReactNode }) => <LeisteEinrollend erzwungen={false}>{children}</LeisteEinrollend>

/** Fall `alle` mit aktivem Filter „DVD / Blu-ray“ (Adresse `rt=disc`): so stehen Chip, „Alle zurücksetzen“ und „Filter 1 ▾“ in der Leiste. */
mockup({
  name: 'filterleiste',
  titel: 'Filterleiste der Datenbank verdeckt weniger',
  ausschnitt: 'datenbank',
  faelle: ['alle'],
  suchadressen: { alle: { rt: 'disc' } },
  varianten: {
    A: {
      ersatz: { FilterBarDock: DockPille },
      notiz: 'Rechner: unten nur die Pille „Filter 1 ▾“ rechts; Chips und Feld erscheinen erst beim Aufklappen. Handy unverändert (Chips liegen dort schon im Fenster).',
    },
    B: {
      ersatz: { FilterBarDock: DockRollt, Werkzeugleiste: LeisteRollt },
      notiz: 'Leiste rollt beim Abwärtsscrollen nach unten weg und kommt beim Aufwärtsscrollen zurück — wie die Kopfleiste am Handy. Oben auf der Seite bleibt sie da; B2 zeigt den weggerollten Zustand.',
    },
    B2: {
      ersatz: { FilterBarDock: DockWeg, Werkzeugleiste: LeisteWeg },
      notiz: 'B nach dem Abwärtsscrollen: Rechner und Handy ohne Leiste, nichts verdeckt.',
    },
    C: {
      ersatz: { DbKopfbereich: KopfMitChips, FilterBarDock: KeinDock },
      notiz: 'Rechner: Chips und Filter-Knopf oben unter den Schaltern, das Feld klappt darunter auf; unten schwebt nichts. Handy unverändert.',
    },
  },
})
