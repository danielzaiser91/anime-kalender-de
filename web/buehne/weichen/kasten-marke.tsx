import { useContext, type ComponentProps } from 'react'
import { AntwortKastenMitMarke as EchterKasten } from '../../src/components/detail/kasten-marke.tsx'
import { ErsatzKontext } from '../ersatz.tsx'

/** Zeigt den Ersatz des Mockups, sonst den echten Antwortkasten (Weiche, `vite-weichen.ts`). */
export function AntwortKastenMitMarke(eigenschaften: ComponentProps<typeof EchterKasten>) {
  const Ersatz = useContext(ErsatzKontext).AntwortKasten
  return Ersatz ? <Ersatz {...eigenschaften} /> : <EchterKasten {...eigenschaften} />
}
