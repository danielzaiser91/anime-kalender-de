import type { ComponentType } from 'react'
import type { AusschnittName } from './ausschnitte/index.ts'
import type { AusschnittEigenschaften } from './ausschnitte/typ.ts'
import type { Fall } from './faelle.ts'
import { mockupMit } from './register.ts'

/** Was eine Zelle zeigt: der Ausschnitt des Mockups, mit Variante und Mockup-Namen (die Ausschnitte kommen von außen, damit der Test nicht die ganze App lädt). */
export function ZelleInhalt({ werte, fall, ausschnitte }: { werte: URLSearchParams; fall: Fall; ausschnitte: Record<AusschnittName, ComponentType<AusschnittEigenschaften>> }) {
  const def = mockupMit(werte.get('mockup') ?? '')
  if (!def) return null
  const Ausschnitt = ausschnitte[def.ausschnitt]
  const kennung = werte.get('v') ?? ''
  const variante = def.varianten[kennung]
  return (
    <>
      {variante?.stil && <style>{variante.stil}</style>}
      <Ausschnitt fall={fall} ersatz={variante?.ersatz ?? {}} mockup={def.name} variante={kennung} fallKennung={werte.get('fall') ?? ''} />
    </>
  )
}
