import { Suspense, type ComponentProps } from 'react'
import { lazyMitRueckfall } from './lazy-mit-rueckfall.tsx'
import { PANEL_SCHLEIER } from './detail/schleier.ts'

/** Das Detailpanel lädt erst beim ersten Öffnen eines Titels (Start-Budget, `tools/start-budget.mjs`). */
const DetailPanel = lazyMitRueckfall<ComponentProps<typeof import('./DetailPanel.tsx').DetailPanel>>(() => import('./DetailPanel.tsx'), (m) => m.DetailPanel)

/** Der Platzhalter ist derselbe Schleier wie im Panel: nichts springt, bis das Paket da ist; ein Klick darauf schließt. */
export function DetailPanelLazy(props: ComponentProps<typeof DetailPanel>) {
  return (
    <Suspense fallback={<div className={PANEL_SCHLEIER} onClick={props.onClose} aria-hidden="true" />}>
      <DetailPanel {...props} />
    </Suspense>
  )
}
