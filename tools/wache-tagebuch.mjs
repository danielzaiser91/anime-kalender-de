/**
 * Tagebuchzeilen der Wache (`daniel-zum-abarbeiten/00-wache.md`): Ein Befund mit gleichem Wortlaut wie eine der Befundzeilen
 * davor wird nicht noch einmal angehängt (19.10.2026: ein pendelnder Bau füllte die Tabelle mit 37 gleichen Zeilen).
 * Gleich heißt: Spalten Kennzahlen, Veränderung und Befund; der Zeitpunkt zählt nicht. Eine unauffällige Zeile dazwischen
 * beendet die Reihe: Kehrt derselbe Befund danach wieder, steht seine Wiederkehr im Tagebuch.
 */

const spalten = (zeile) => zeile.split('|').slice(2, -1).map((s) => s.trim())

/** Die Zeilen von `alt` (neueste zuerst) bis vor die erste unauffällige. */
function reiheSeitRuhe(alt) {
  const ruhe = alt.findIndex((z) => spalten(z).at(-1) === 'unauffällig')
  return ruhe < 0 ? alt : alt.slice(0, ruhe)
}

/** Die Tagebuchzeilen nach dem Anhängen von `neu` vorn an `alt`; unauffällige Zeilen werden immer angehängt. */
export function tagebuchZeilen(neu, alt, befund) {
  const text = spalten(neu).join('|')
  if (befund && reiheSeitRuhe(alt).some((z) => spalten(z).join('|') === text)) return alt
  return [neu, ...alt]
}
