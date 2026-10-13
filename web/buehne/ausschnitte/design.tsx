import { DesignTafel } from '../mockups/design-regeln-teile.tsx'
import type { AusschnittEigenschaften } from './typ.ts'

/** Ausschnitt `design`: alle Farbrollen und Zustände (docs/wissen/design-regeln.md), ohne Fall — die Tafel lebt unter `mockups/`, damit ihre Klassen gebaut werden. */
export function Design(_: AusschnittEigenschaften) {
  return <DesignTafel />
}
