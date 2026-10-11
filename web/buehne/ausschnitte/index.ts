import type { ComponentType } from 'react'
import { Detailpanel } from './detailpanel.tsx'
import type { AusschnittEigenschaften } from './typ.ts'

/** Die Ausschnitte, die ein Mockup wählen kann. */
export const AUSSCHNITTE = { detailpanel: Detailpanel } satisfies Record<string, ComponentType<AusschnittEigenschaften>>

export type AusschnittName = keyof typeof AUSSCHNITTE
