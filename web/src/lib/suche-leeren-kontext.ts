import { createContext } from 'react'

/**
 * Das × am Such-Chip der Datenbank (13.10.2026). Die Suche geht nicht durch `onChange` der Filter
 * (`setFilters` in App lässt sie beim Zurücksetzen stehen, 29.09.2026), sondern über diesen Rückruf.
 * Ohne Anbieter (Kalender, dort ist die Suche leer) gibt es keinen Such-Chip.
 */
export const SucheLeerenContext = createContext<(() => void) | null>(null)
