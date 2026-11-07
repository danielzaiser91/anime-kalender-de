import { Suspense, type ComponentProps } from 'react'
import { lazyMitRueckfall } from './lazy-mit-rueckfall.tsx'

/** Die Datenbank-Ansicht lädt erst auf ihrer Adresse (Start-Budget, `tools/start-budget.mjs`). */
const DatenbankBereich = lazyMitRueckfall<ComponentProps<typeof import('./DatenbankBereich.tsx').DatenbankBereich>>(() => import('./DatenbankBereich.tsx'), (m) => m.DatenbankBereich)

/** Der Platzhalter hält die Fußzeile unten, bis das Paket da ist. */
export function DatenbankBereichLazy(props: ComponentProps<typeof DatenbankBereich>) {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" aria-hidden />}>
      <DatenbankBereich {...props} />
    </Suspense>
  )
}
