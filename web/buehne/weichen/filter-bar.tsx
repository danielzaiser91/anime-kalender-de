import { useContext } from 'react'
import { FilterBarDock as EchtesDock, type FilterBarProps } from '../../src/components/FilterBar.tsx'
import { ErsatzKontext } from '../ersatz.tsx'

/** Alles andere aus `FilterBar.tsx` bleibt; ausgetauscht werden kann die unten angedockte Filterleiste der Datenbank (Rechner). */
export * from '../../src/components/FilterBar.tsx'

export function FilterBarDock(eigenschaften: FilterBarProps) {
  const Dock = useContext(ErsatzKontext).FilterBarDock ?? EchtesDock
  return <Dock {...eigenschaften} />
}
