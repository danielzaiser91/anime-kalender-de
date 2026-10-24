import type { ViewId } from './router.ts'

/** Ob die Adresse eine der nachgeladenen Seitenansichten zeigt; Kalender und Datenbank zeichnet `App.tsx` selbst. */
export function brauchtSeitenAnsicht(view: ViewId): boolean {
  return view !== 'woche' && view !== 'monat' && view !== 'datenbank'
}
