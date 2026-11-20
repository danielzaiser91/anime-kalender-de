import { useContext } from 'react'
import { ReihenListe as EchteReihenListe } from '../../src/components/detail/reihen-liste.tsx'
import type { ReihenListeProps } from '../../src/components/detail/reihen-inhalt.tsx'
import { ErsatzKontext } from '../ersatz.tsx'

/** Zeigt den Ersatz des Mockups, sonst die echte Reihenliste. */
export function ReihenListe(eigenschaften: ReihenListeProps) {
  const Liste = useContext(ErsatzKontext).ReihenListe ?? EchteReihenListe
  return <Liste {...eigenschaften} />
}
