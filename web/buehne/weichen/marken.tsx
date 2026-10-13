import { useContext, type ComponentProps } from 'react'
import { ZeitMarke as EchteZeitMarke } from '../../src/components/kalender/Marken.tsx'
import { ErsatzKontext } from '../ersatz.tsx'

/** Alles andere aus `Marken.tsx` bleibt, wie es ist; nur die Uhrzeit-Pille ist austauschbar. */
export * from '../../src/components/kalender/Marken.tsx'

export function ZeitMarke(eigenschaften: ComponentProps<typeof EchteZeitMarke>) {
  const Marke = useContext(ErsatzKontext).ZeitMarke ?? EchteZeitMarke
  return <Marke {...eigenschaften} />
}
