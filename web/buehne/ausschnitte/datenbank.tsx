import { useState } from 'react'
import { mockupMit } from '../register.ts'
import { Ganz } from './ganz.tsx'
import type { AusschnittEigenschaften } from './typ.ts'

/** Stellt die Adresse auf „Datenbank“ mit den Parametern des Falls (Suche, Jahr …), bevor die App sie liest. */
function oeffneDatenbank(parameter: Record<string, string>): true {
  history.replaceState(null, '', `${location.pathname}${location.search}#/datenbank?${new URLSearchParams(parameter)}`)
  return true
}

/** Ausschnitt `datenbank`: die ganze App, geöffnet in der Datenbank mit den Adressparametern des Falls (`suchadressen` des Mockups; ohne Kennung gilt der erste Fall). */
export function DatenbankSuche(eigenschaften: AusschnittEigenschaften) {
  const def = mockupMit(eigenschaften.mockup)
  const kennung = eigenschaften.fallKennung || def?.faelle[0] || ''
  useState(() => oeffneDatenbank(def?.suchadressen?.[kennung] ?? {}))
  return <Ganz {...eigenschaften} />
}
