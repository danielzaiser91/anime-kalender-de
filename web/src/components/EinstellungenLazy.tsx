import { Suspense, type ComponentProps } from 'react'
import { lazyMitRueckfall } from './lazy-mit-rueckfall.tsx'

/** Der Einstellungen-Dialog lädt erst beim ersten Öffnen (Start-Budget, `tools/start-budget.mjs`). */
const EinstellungenDialog = lazyMitRueckfall<ComponentProps<typeof import('./Einstellungen.tsx').EinstellungenDialog>>(() => import('./Einstellungen.tsx'), (m) => m.EinstellungenDialog)

/** Zu bleibt ohne Paket; der Dialog ist ein Schleier über der Seite, der Platzhalter braucht keine Höhe. */
export function EinstellungenLazy(props: ComponentProps<typeof EinstellungenDialog>) {
  if (!props.offen) return null
  return (
    <Suspense fallback={null}>
      <EinstellungenDialog {...props} />
    </Suspense>
  )
}
