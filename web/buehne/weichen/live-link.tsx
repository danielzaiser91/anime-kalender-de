import { useContext, type ComponentProps } from 'react'
import { LiveLink as EchterLink } from '../../src/components/detail/live-link.tsx'
import { ErsatzKontext } from '../ersatz.tsx'

/** Zeigt den Ersatz des Mockups, sonst den echten Live-Knopf (Weiche, `vite-weichen.ts`). */
export function LiveLink(eigenschaften: ComponentProps<typeof EchterLink>) {
  const Ersatz = useContext(ErsatzKontext).LiveLink ?? EchterLink
  return <Ersatz {...eigenschaften} />
}
