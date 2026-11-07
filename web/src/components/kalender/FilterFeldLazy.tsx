import { Suspense, type ComponentProps } from 'react'
import { lazyMitRueckfall } from '../lazy-mit-rueckfall.tsx'

/** Das Filterfeld lädt erst beim ersten Aufklappen (Start-Budget, `tools/start-budget.mjs`). */
const FilterFeld = lazyMitRueckfall<ComponentProps<typeof import('./FilterFeld.tsx').FilterFeld>>(() => import('./FilterFeld.tsx'), (m) => m.FilterFeld)

/** Der Platzhalter hat eine Mindesthöhe, damit das Aufklappen nicht nachspringt. */
export function FilterFeldLazy(props: ComponentProps<typeof FilterFeld>) {
  return (
    <Suspense fallback={<div className="min-h-[12rem]" aria-hidden />}>
      <FilterFeld {...props} />
    </Suspense>
  )
}
