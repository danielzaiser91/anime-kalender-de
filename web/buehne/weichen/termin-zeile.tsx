import { useContext, type ComponentProps } from 'react'
import { TerminZeile as EchteZeile } from '../../src/components/detail/termin-zeile.tsx'
import { ErsatzKontext } from '../ersatz.tsx'

/** Zeigt den Ersatz des Mockups, sonst die echte Terminzeile (Weiche, `vite-weichen.ts`). */
export function TerminZeile(eigenschaften: ComponentProps<typeof EchteZeile>) {
  const Zeile = useContext(ErsatzKontext).TerminZeile ?? EchteZeile
  return <Zeile {...eigenschaften} />
}
