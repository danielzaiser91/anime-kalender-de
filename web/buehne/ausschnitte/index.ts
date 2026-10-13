import type { ComponentType } from 'react'
import { Design } from './design.tsx'
import { Detailpanel } from './detailpanel.tsx'
import { Filter } from './filter.tsx'
import { Ganz } from './ganz.tsx'
import { Kachel } from './kachel.tsx'
import type { AusschnittEigenschaften } from './typ.ts'

/** Die Ausschnitte, die ein Mockup wählen kann; `detailpanel` zeigt einen Fall, `design` keinen (Farbrollen und Zustände), die übrigen den Gesamtbestand. */
export const AUSSCHNITTE = { detailpanel: Detailpanel, filter: Filter, kachel: Kachel, ganz: Ganz, design: Design } satisfies Record<string, ComponentType<AusschnittEigenschaften>>

export type AusschnittName = keyof typeof AUSSCHNITTE
