import { createContext } from 'react'
import type { Herkunft } from './herkunft.ts'

/**
 * Titel je Herkunft im Bestand der Ansicht — `App` stellt sie bereit (Datenbank: alle geladenen Titel;
 * Kalender: Termine des Zeitraums). Ohne Wert zeigt das Filterfenster die Gruppe „Herkunft" nicht.
 */
export const HerkunftZaehlungContext = createContext<Map<Herkunft, number> | undefined>(undefined)
