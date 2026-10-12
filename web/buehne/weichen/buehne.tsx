import { useContext, type ComponentProps } from 'react'
import { PanelBuehne as EchteBuehne } from '../../src/components/detail/buehne.tsx'
import { ErsatzKontext } from '../ersatz.tsx'

export function PanelBuehne(eigenschaften: ComponentProps<typeof EchteBuehne>) {
  const Buehne = useContext(ErsatzKontext).PanelBuehne ?? EchteBuehne
  return <Buehne {...eigenschaften} />
}
