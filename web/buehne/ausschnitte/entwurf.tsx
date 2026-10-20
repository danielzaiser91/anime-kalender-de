import { waehleEntwurf } from '../entwurf-wahl.ts'
import { mockupMit } from '../register.ts'
import type { AusschnittEigenschaften } from './typ.ts'

/** Ausschnitt `entwurf`: eigene Ansicht je Variante für Neues ohne Gegenstück in der App; Vorher zeigt die heutige Seite oder „Neu“. */
export function EntwurfAnsicht({ fall, mockup, variante }: AusschnittEigenschaften) {
  const Ansicht = waehleEntwurf(mockupMit(mockup), variante)
  if (Ansicht) return <Ansicht fall={fall} />
  return (
    <p className="m-4 rounded-xl border border-dashed border-ak-rand p-6 text-center text-sm text-ak-leise">
      Neu – diese Ansicht gibt es heute nicht.
    </p>
  )
}
