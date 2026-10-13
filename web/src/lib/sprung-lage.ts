/** Wo das Datumsfenster aufgeht: unter dem Knopf, wenn dort Platz ist, sonst darüber — und nie höher als der Platz. */
export interface SprungLage {
  left: number
  top?: number
  bottom?: number
  maxHoehe: number
}

/** Höhe des Fensters in der Tagesansicht (Kopf, Wochentage, sechs Wochen, Fuß), gemessen 13.10.2026. */
const WUNSCH = 330
const ABSTAND = 6
const RAND = 8
const BREITE = 280

export function sprungLage(knopf: { top: number; bottom: number; left: number }, fenster: { breite: number; hoehe: number }): SprungLage {
  const left = Math.max(RAND, Math.min(knopf.left, fenster.breite - BREITE - 2 * RAND))
  const unten = fenster.hoehe - knopf.bottom - ABSTAND - RAND
  const oben = knopf.top - ABSTAND - RAND
  if (unten >= WUNSCH || unten >= oben) return { left, top: knopf.bottom + ABSTAND, maxHoehe: unten }
  return { left, bottom: fenster.hoehe - knopf.top + ABSTAND, maxHoehe: oben }
}
