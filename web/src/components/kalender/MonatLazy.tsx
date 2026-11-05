import { lazy, Suspense, type ComponentProps } from 'react'

/** Die Monatsansicht lädt erst, wenn jemand sie wählt (Start-Budget, `tools/start-budget.mjs`). */
const MonthView = lazy(() => import('../MonthView.tsx').then((m) => ({ default: m.MonthView })))

/** Der Platzhalter hält die Höhe eines Monatsrasters, bis das Paket da ist. */
export function MonatLazy(props: ComponentProps<typeof MonthView>) {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" aria-hidden />}>
      <MonthView {...props} />
    </Suspense>
  )
}
