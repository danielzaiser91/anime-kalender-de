import { createContext, useContext } from 'react'
import type { Fundstelle } from './search.ts'

/**
 * **Woher ein Suchtreffer kommt — für alle Karten einer Ansicht** (29.09.2026).
 *
 * Die Suche liefert die Fundstellen (`sucheMitFundstellen`), die Karten sollen sie zeigen, ohne
 * dass jede Karten-Komponente sie durch zehn Ebenen gereicht bekommt. Der Schlüssel ist je Ansicht
 * verschieden: in der Datenbank die Titel-Kennung, im Kalender der Verlaufs-Slug des Termins —
 * beides sind die Kennungen, unter denen die Filterfunktionen die Fundstellen ablegen.
 */
export const SuchfundstellenContext = createContext<Map<string, Fundstelle[]>>(new Map())

export function useFundstellen(schluessel: string): Fundstelle[] | undefined {
  const karte = useContext(SuchfundstellenContext)
  const treffer = karte.get(schluessel)
  return treffer?.length ? treffer : undefined
}
