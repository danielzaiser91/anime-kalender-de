import { Suspense, type ComponentProps } from 'react'
import { lazyMitRueckfall } from './lazy-mit-rueckfall.tsx'
import { brauchtSeitenAnsicht } from '../lib/seiten-ansicht.ts'
import { EmpfehlungLazy } from './EmpfehlungLazy.tsx'

/** News, Saison, Abo, Newsletter, Quellen, Impressum, Datenschutz laden erst auf ihrer Adresse (Start-Budget, `tools/start-budget.mjs`). */
const SeitenAnsicht = lazyMitRueckfall<ComponentProps<typeof import('./SeitenAnsicht.tsx').SeitenAnsicht>>(() => import('./SeitenAnsicht.tsx'), (m) => m.SeitenAnsicht)

/** Der Platzhalter hält die Fußzeile unten, bis das Paket da ist. */
export function SeitenAnsichtLazy(props: ComponentProps<typeof SeitenAnsicht>) {
  if (props.route.view === 'entdecken') return <EmpfehlungLazy data={props.data} />
  if (!brauchtSeitenAnsicht(props.route.view)) return null
  return (
    <Suspense fallback={<div className="min-h-[60vh]" aria-hidden />}>
      <SeitenAnsicht {...props} />
    </Suspense>
  )
}
