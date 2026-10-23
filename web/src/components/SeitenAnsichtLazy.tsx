import { lazy, Suspense, type ComponentProps } from 'react'
import { brauchtSeitenAnsicht } from '../lib/seiten-ansicht.ts'

/** News, Saison, Abo, Newsletter, Quellen, Impressum, Datenschutz laden erst auf ihrer Adresse (Start-Budget, `tools/start-budget.mjs`). */
const SeitenAnsicht = lazy(() => import('./SeitenAnsicht.tsx').then((m) => ({ default: m.SeitenAnsicht })))

/** Der Platzhalter hält die Fußzeile unten, bis das Paket da ist. */
export function SeitenAnsichtLazy(props: ComponentProps<typeof SeitenAnsicht>) {
  if (!brauchtSeitenAnsicht(props.route.view)) return null
  return (
    <Suspense fallback={<div className="min-h-[60vh]" aria-hidden />}>
      <SeitenAnsicht {...props} />
    </Suspense>
  )
}
