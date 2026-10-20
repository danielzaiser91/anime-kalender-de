import type { ComponentType } from 'react'
import { EntwurfAnsicht } from './entwurf.tsx'
import type { AusschnittEigenschaften } from './typ.ts'

/** Ausschnitte ohne App-Bauteile; eigene Datei, damit ein Test sie ohne die ganze App laden kann. */
export const EIGENE_AUSSCHNITTE = { entwurf: EntwurfAnsicht } satisfies Record<string, ComponentType<AusschnittEigenschaften>>
