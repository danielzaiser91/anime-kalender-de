import { useState } from 'react'
import { mockupMit } from '../register.ts'
import { Ganz } from './ganz.tsx'
import type { AusschnittEigenschaften } from './typ.ts'

/** Stellt die Adresse auf „Datenbank, Suche nach …“, bevor die App sie liest. */
function oeffneSuche(suche: string): true {
  history.replaceState(null, '', `${location.pathname}${location.search}#/datenbank?${new URLSearchParams({ q: suche })}`)
  return true
}

/** Ausschnitt `datenbank`: die ganze App, geöffnet in der Datenbank mit dem Suchbegriff des Falls (`suchbegriffe` des Mockups). */
export function DatenbankSuche(eigenschaften: AusschnittEigenschaften) {
  useState(() => oeffneSuche(mockupMit(eigenschaften.mockup)?.suchbegriffe?.[eigenschaften.fall.titleId] ?? ''))
  return <Ganz {...eigenschaften} />
}
