import { useContext, type ComponentProps } from 'react'
import { Pille as EchtePille } from '../../src/components/detail/pille.tsx'
import { ErsatzKontext } from '../ersatz.tsx'

export { DubStatus } from '../../src/components/detail/pille.tsx'

/** Zeigt den Ersatz des Mockups, sonst die echte Pille (Weiche, `vite-weichen.ts`). */
export function Pille(eigenschaften: ComponentProps<typeof EchtePille>) {
  const Ersatz = useContext(ErsatzKontext).Pille ?? EchtePille
  return <Ersatz {...eigenschaften} />
}
