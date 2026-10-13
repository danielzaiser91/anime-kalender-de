import { useContext, type ComponentProps } from 'react'
import { TvKasten as EchterKasten } from '../../src/components/kalender/TvKasten.tsx'
import { ErsatzKontext } from '../ersatz.tsx'

export function TvKasten(eigenschaften: ComponentProps<typeof EchterKasten>) {
  const Kasten = useContext(ErsatzKontext).TvKasten ?? EchterKasten
  return <Kasten {...eigenschaften} />
}
