import { Suspense, type ComponentProps } from 'react'
import { lazyMitRueckfall } from '../lazy-mit-rueckfall.tsx'

/** Die Monatsansicht lädt erst, wenn jemand sie wählt (Start-Budget, `tools/start-budget.mjs`). */
const MonthView = lazyMitRueckfall<ComponentProps<typeof import('../MonthView.tsx').MonthView>>(() => import('../MonthView.tsx'), (m) => m.MonthView)

/** Der Platzhalter hält die Höhe eines Monatsrasters, bis das Paket da ist. */
export function MonatLazy(props: ComponentProps<typeof MonthView>) {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" aria-hidden />}>
      <MonthView {...props} />
    </Suspense>
  )
}
