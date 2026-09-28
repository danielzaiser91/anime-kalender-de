/**
 * **Weitergeleitet nach `shared/tv-signale.ts`** (28.09.2026).
 *
 * „Staffelstart" und „Staffelfinale" wurden hier entschieden — aber der Newsletter entsteht im
 * Worker, und der Newsletter braucht dieselbe Antwort. Beide stehen jetzt in `shared/`: eine
 * Rechnung, zwei Abnehmer (Oberfläche und Bau/Newsletter). Diese Datei bleibt, damit die
 * bestehenden Aufrufer ihren Pfad behalten.
 */
export { istStaffelstart, istStaffelfinale } from '@shared/tv-signale.ts'
