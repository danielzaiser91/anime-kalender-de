import { useState } from 'react'
import { DetailPanel } from '../../src/components/DetailPanel.tsx'
import { ErsatzKontext } from '../ersatz.tsx'
import { startAufDisc } from '../fall-optionen.ts'
import { useDatensatz } from './datensatz.ts'
import type { AusschnittEigenschaften } from './typ.ts'

const LEER = new Set<number>()
const nichts = () => {}

/** Ausschnitt `detailpanel`: das echte Panel mit den Daten des Falls; Wechsel auf einen Teil der Reihe geht wie in der Seite. */
export function Detailpanel({ fall, ersatz, fallKennung }: AusschnittEigenschaften) {
  const data = useDatensatz()
  const [offen, setOffen] = useState(fall.titleId)
  if (!data) return null
  return (
    <ErsatzKontext.Provider value={ersatz}>
      <DetailPanel
        data={data}
        titleId={offen}
        favorites={LEER}
        hidden={LEER}
        onToggleFavorite={nichts}
        onToggleHidden={nichts}
        onClose={nichts}
        onFilterBy={nichts}
        onOpenTitle={setOffen}
        discZuerst={startAufDisc(fallKennung)}
      />
    </ErsatzKontext.Provider>
  )
}
