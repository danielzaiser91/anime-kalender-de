import { Suspense, type ComponentProps } from 'react'
import { lazyMitRueckfall } from '../lazy-mit-rueckfall.tsx'

/** Die Monatsansicht lädt erst, wenn jemand sie wählt (Start-Budget, `tools/start-budget.mjs`). */
const MonthView = lazyMitRueckfall<ComponentProps<typeof import('../MonthView.tsx').MonthView>>(() => import('../MonthView.tsx'), (m) => m.MonthView)

/** Der Platzhalter füllt mindestens den Bildschirm, bis das Paket da ist: sonst rutscht der Fuß der kürzeren Seite ins Bild (CLS 0,25 am Desktop, gemessen 08.11.2026). */
export function MonatLazy(props: ComponentProps<typeof MonthView>) {
  return (
    <Suspense fallback={<div className="min-h-screen" aria-hidden />}>
      <MonthView {...props} />
    </Suspense>
  )
}
