import { useState } from 'react'
import { createIdSet } from './idSet.ts'

/** „Schon gesehen“ (nimmt den Titel für immer aus dem Pool) und „Nicht interessiert“ (endgültig, einzeln zurückholbar); nur im Browser. */
export const empfehlungGesehen = createIdSet('empfehlung:gesehen')
export const empfehlungVerworfen = createIdSet('empfehlung:verworfen')

/** Anbieter, die bevorzugt werden (Vorrang, kein Filter); derselbe Schlüssel wie „Meine Anbieter“ in der Datenbank. */
const ANBIETER = 'meineAnbieter'

export function eigeneAnbieterLesen(): string[] {
  try {
    const roh = JSON.parse(localStorage.getItem(ANBIETER) ?? '[]') as unknown
    return Array.isArray(roh) ? roh.filter((p): p is string => typeof p === 'string') : []
  } catch {
    return []
  }
}

/** Die Wahl in der Reise bleibt eine Einstellung dieser Ansicht und überschreibt „Meine Anbieter“ der Datenbank nicht. */
const ANBIETER_REISE = 'empfehlung:anbieter'

export function reiseAnbieterLesen(): string[] {
  try {
    const roh = localStorage.getItem(ANBIETER_REISE)
    if (roh === null) return eigeneAnbieterLesen()
    const liste = JSON.parse(roh) as unknown
    return Array.isArray(liste) ? liste.filter((p): p is string => typeof p === 'string') : []
  } catch {
    return []
  }
}

export function reiseAnbieterSchreiben(anbieter: string[]): void {
  try {
    localStorage.setItem(ANBIETER_REISE, JSON.stringify(anbieter))
  } catch {
    /* Gesperrter Speicher: die Wahl gilt dann für diesen Besuch. */
  }
}

/** Die gewählten Anbieter als Zustand, geschrieben bei jeder Änderung. */
export function useReiseAnbieter(): [string[], (liste: string[]) => void] {
  const [eigene, setEigene] = useState(reiseAnbieterLesen)
  const setze = (liste: string[]) => {
    setEigene(liste)
    reiseAnbieterSchreiben(liste)
  }
  return [eigene, setze]
}
