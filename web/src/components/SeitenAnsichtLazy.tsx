import { lazy, Suspense, type ComponentProps } from 'react'

/** News, Saison, Abo, Newsletter, Quellen, Impressum, Datenschutz laden erst auf ihrer Adresse (Start-Budget, `tools/start-budget.mjs`). */
const SeitenAnsicht = lazy(() => import('./SeitenAnsicht.tsx').then((m) => ({ default: m.SeitenAnsicht })))

/** Kalender und Datenbank zeichnet `App.tsx` selbst; für sie wird das Bündel der Seitenansichten nicht geholt. */
export function SeitenAnsichtLazy(props: ComponentProps<typeof SeitenAnsicht>) {
  const { view } = props.route
  if (view === 'woche' || view === 'monat' || view === 'datenbank') return null
  return (
    <Suspense fallback={null}>
      <SeitenAnsicht {...props} />
    </Suspense>
  )
}
