import { lazy, Suspense, type ComponentProps } from 'react'

/** Der Einstellungen-Dialog lädt erst beim ersten Öffnen (Start-Budget, `tools/start-budget.mjs`). */
const EinstellungenDialog = lazy(() => import('./Einstellungen.tsx').then((m) => ({ default: m.EinstellungenDialog })))

/** Zu bleibt ohne Paket; der Dialog ist ein Schleier über der Seite, der Platzhalter braucht keine Höhe. */
export function EinstellungenLazy(props: ComponentProps<typeof EinstellungenDialog>) {
  if (!props.offen) return null
  return (
    <Suspense fallback={null}>
      <EinstellungenDialog {...props} />
    </Suspense>
  )
}
