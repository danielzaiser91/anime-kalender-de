import type { ComponentType } from 'react'
import { Detailpanel } from './detailpanel.tsx'
import { Filter } from './filter.tsx'
import { Ganz } from './ganz.tsx'
import { Kachel } from './kachel.tsx'
import type { AusschnittEigenschaften } from './typ.ts'

/** Die Ausschnitte, die ein Mockup wählen kann; `detailpanel` zeigt einen Fall, die übrigen den Gesamtbestand. */
export const AUSSCHNITTE = { detailpanel: Detailpanel, filter: Filter, kachel: Kachel, ganz: Ganz } satisfies Record<string, ComponentType<AusschnittEigenschaften>>

export type AusschnittName = keyof typeof AUSSCHNITTE
