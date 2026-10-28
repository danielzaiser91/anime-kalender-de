import { useContext, type ComponentProps } from 'react'
import { Werkzeugleiste as EchteLeiste } from '../../src/components/filter/Werkzeugleiste.tsx'
import { ErsatzKontext } from '../ersatz.tsx'

/** Alles andere aus `Werkzeugleiste.tsx` bleibt (`FilterRund`); ausgetauscht werden kann die Leiste am unteren Rand (Handy). */
export * from '../../src/components/filter/Werkzeugleiste.tsx'

export function Werkzeugleiste(eigenschaften: ComponentProps<typeof EchteLeiste>) {
  const Leiste = useContext(ErsatzKontext).Werkzeugleiste ?? EchteLeiste
  return <Leiste {...eigenschaften} />
}
