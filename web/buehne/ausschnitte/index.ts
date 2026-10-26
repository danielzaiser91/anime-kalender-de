import type { ComponentType } from 'react'
import { DatenbankSuche } from './datenbank.tsx'
import { Design } from './design.tsx'
import { Detailpanel } from './detailpanel.tsx'
import { EIGENE_AUSSCHNITTE } from './eigene.ts'
import { Filter } from './filter.tsx'
import { Ganz } from './ganz.tsx'
import { Kachel } from './kachel.tsx'
import type { AusschnittEigenschaften } from './typ.ts'

/** Die Ausschnitte, die ein Mockup wählen kann; `detailpanel` zeigt einen Fall, `design` keinen (Farbrollen und Zustände), `entwurf` eigene Ansichten je Variante für Neues ohne Gegenstück in der App, die übrigen den Gesamtbestand. */
export const AUSSCHNITTE = { detailpanel: Detailpanel, filter: Filter, kachel: Kachel, ganz: Ganz, datenbank: DatenbankSuche, design: Design, ...EIGENE_AUSSCHNITTE } satisfies Record<string, ComponentType<AusschnittEigenschaften>>

export type AusschnittName = keyof typeof AUSSCHNITTE
