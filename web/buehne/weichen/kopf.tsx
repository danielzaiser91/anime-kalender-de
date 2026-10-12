import { useContext, type ComponentProps } from 'react'
import { PanelKopf as EchterKopf } from '../../src/components/detail/kopf.tsx'
import { ErsatzKontext } from '../ersatz.tsx'

export function PanelKopf(eigenschaften: ComponentProps<typeof EchterKopf>) {
  const Kopf = useContext(ErsatzKontext).PanelKopf ?? EchterKopf
  return <Kopf {...eigenschaften} />
}
