/**
 * **Wann ein YouTube-Lauf nichts schreiben darf.**
 *
 * Liegt in einer eigenen Datei, weil `check-youtube.ts` beim Laden arbeitet und deshalb
 * nicht importiert werden darf (CLAUDE.md). `check:logic` prüft die Regel mit den realen
 * Zahlen.
 *
 * **Gezählt werden nur Störungen — keine gesperrten Videos** (23.09.2026, Issue #215). Bis
 * dahin ging `leer` mit in die Rechnung: beantwortete Abfragen mit dem Ergebnis „in
 * Deutschland gesperrt", bei Anime auf YouTube der Normalfall. 362 von 514 Verweisen (70 %)
 * stehen so im Bestand; der Lauf vom 21.09.2026 maß 363 von 514, also denselben Zustand, und
 * wurde trotzdem verworfen. Da dieser Zweig auch `recordSource()` überspringt, fror `lastOk`
 * ein, und neun Tage später brach der Bestandslauf an der Schweigen-Prüfung ab (35855024971).
 *
 * Eine Störung ist das Gegenteil: keine Antwort — Kontingent, Netz, Sperre. Genau davor
 * schützt der Riegel, und nur das zählt er.
 */
export function riegelGreift(geprueft: number, stoerung: number): boolean {
  /* Unter zwanzig Abfragen sagt der Anteil nichts. */
  return geprueft >= 20 && stoerung / geprueft > 0.5
}
