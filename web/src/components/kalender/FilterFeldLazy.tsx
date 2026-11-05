import { lazy, Suspense, type ComponentProps } from 'react'

/** Das Filterfeld lädt erst beim ersten Aufklappen (Start-Budget, `tools/start-budget.mjs`). */
const FilterFeld = lazy(() => import('./FilterFeld.tsx').then((m) => ({ default: m.FilterFeld })))

/** Der Platzhalter hat eine Mindesthöhe, damit das Aufklappen nicht nachspringt. */
export function FilterFeldLazy(props: ComponentProps<typeof FilterFeld>) {
  return (
    <Suspense fallback={<div className="min-h-[12rem]" aria-hidden />}>
      <FilterFeld {...props} />
    </Suspense>
  )
}
