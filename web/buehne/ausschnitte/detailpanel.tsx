import { useState } from 'react'
import { DetailPanel } from '../../src/components/DetailPanel.tsx'
import type { Dataset } from '../../src/lib/data.ts'
import { ErsatzKontext, type Ersatz } from '../ersatz.tsx'

const LEER = new Set<number>()
const nichts = () => {}

/** Ausschnitt `detailpanel`: das echte Panel mit den Daten des Falls; Wechsel auf einen Teil der Reihe geht wie in der Seite. */
export function Detailpanel({ data, titleId, ersatz }: { data: Dataset; titleId: number; ersatz: Partial<Ersatz> }) {
  const [offen, setOffen] = useState(titleId)
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
      />
    </ErsatzKontext.Provider>
  )
}
