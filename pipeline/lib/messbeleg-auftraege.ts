import { offeneMessbelege } from './ausgeblieben.ts'

/**
 * Crunchyrolls Kalender (`/de/simulcastcalendar`) leitet seit ~21.10.2026 auf `/de/simulcasts` um (docs/wissen/quellen.md, 27.10.2026): ein Foto
 * davon zeigt die Zielseite, nicht den Tag. Solange das so ist, gibt es keine Messbeleg-Aufträge; wieder an, wenn ein Tageskalender zurückkehrt.
 */
export const KALENDER_ERREICHBAR = false

export function messbelegAuftraege(...args: Parameters<typeof offeneMessbelege>): ReturnType<typeof offeneMessbelege> {
  return KALENDER_ERREICHBAR ? offeneMessbelege(...args) : []
}
