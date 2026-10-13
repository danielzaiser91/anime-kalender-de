/**
 * Exit-Codes von `bau-vergleich.mjs`. Ein Konflikt beim Übernehmen der eigenen data/-Änderungen (Drei-Wege-Übernahme)
 * ist weder „gleich“ noch „verschieden“: es wurde nichts verglichen. Er bekam früher als unbehandelte Ausnahme Exit 1
 * und sah aus wie ein Unterschied im Ergebnis (12.10.2026).
 */
import { DatenKonflikt } from './bau-vergleich-daten.mjs'

export const EXIT = { GLEICH: 0, VERSCHIEDEN: 1, BAU_BASIS: 2, SPERRE: 3, KONFLIKT: 4 }

/** Exit-Code für einen Fehler beim Bau des Kandidaten: `EXIT.KONFLIKT` bei einem Datenkonflikt, sonst `null` (weiterwerfen). */
export function exitFuerFehler(fehler) {
  return fehler instanceof DatenKonflikt ? EXIT.KONFLIKT : null
}
