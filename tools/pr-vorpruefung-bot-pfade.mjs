/**
 * Teil der Vorprüfung (`pr-vorpruefung.mjs`): der Bot-Pfade-Wächter (`pr-nachrechnen-bot-pfade.test.mjs`) läuft schon vor dem Push, wenn der Diff
 * eine Datei der PR-Kette berührt. Sonst wurde ein neuer Test mit Bot-Dateinamen erst in der Kette rot (Bauer 2246, 28.10.2026).
 * Die Auswahl der Kettendateien ist `kettenDateien` des Wächters selbst; dazu die Prüfliste (sie macht Skripte erst zur Kette) und der Wächter.
 */
import { kettenDateien } from './pr-nachrechnen-bot-pfade-leser.mjs'

export const BOT_PFADE_TEST = 'tools/pr-nachrechnen-bot-pfade.test.mjs'

/** Berührt der Diff eine Datei, die der Wächter durchsucht, oder den Wächter und die Logik-Liste selbst? */
export function botPfadeNoetig(dateien, ketten) {
  const kette = new Set([...ketten, 'tools/check-logic-liste.txt'])
  return dateien.some((d) => kette.has(d) || d.startsWith('tools/pr-nachrechnen-bot-pfade'))
}

/** Rote Befunde des Wächters (leer, wenn der Diff keine Kettendatei berührt; `fahre()` startet den Wächter und liefert dessen Befunde). */
export function botPfadeRot(dateien, wurzel, fahre) {
  return botPfadeNoetig(dateien, kettenDateien(wurzel)) ? fahre() : []
}
