import { lazy, Suspense, type ComponentProps } from 'react'

/** Die Datenbank-Ansicht lädt erst auf ihrer Adresse (Start-Budget, `tools/start-budget.mjs`). */
const DatenbankBereich = lazy(() => import('./DatenbankBereich.tsx').then((m) => ({ default: m.DatenbankBereich })))

/** Der Platzhalter hält die Fußzeile unten, bis das Paket da ist. */
export function DatenbankBereichLazy(props: ComponentProps<typeof DatenbankBereich>) {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" aria-hidden />}>
      <DatenbankBereich {...props} />
    </Suspense>
  )
}
