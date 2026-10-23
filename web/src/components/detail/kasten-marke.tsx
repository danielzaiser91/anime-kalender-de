import type { ComponentProps } from 'react'
import { AntwortKasten } from './antwort-kasten.tsx'
import { KopfSagtOffen } from './pille.tsx'

/**
 * Sagt der Kopf „Anbieter, Sprache offen“ (alle Zeilen ohne Beleg, Art „fertig“/„film“), entfällt die Marke „Sprache offen“ an den
 * Pillen daneben: ein Zustand steht nur einmal auf dem Bildschirm (Dirigent, 22.10.2026).
 */
export function AntwortKastenMitMarke(props: ComponentProps<typeof AntwortKasten>) {
  const art = props.antwort.art
  const kopfOffen = props.ohneSprachbeleg === true && (art === 'fertig' || art === 'film')
  return (
    <KopfSagtOffen.Provider value={kopfOffen}>
      <AntwortKasten {...props} />
    </KopfSagtOffen.Provider>
  )
}
