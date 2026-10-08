/**
 * Klassen für Vorschau `tippziele`: Mindest-Trefferfläche 44 px, optisch unverändert.
 * Die Fläche liegt als unsichtbares `::after` über dem Element; es braucht `relative`.
 */
export const TIPPFLAECHE =
  'relative after:absolute after:left-1/2 after:top-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2'

/** Wie `TIPPFLAECHE`, aber nur senkrecht auf 44 px erweitert (breite Textknöpfe in einer Zeile). */
export const TIPPFLAECHE_HOCH =
  'relative after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2'

/** Dasselbe für alle Knöpfe in einem Container (die Knöpfe selbst gehören anderen Bausteinen). */
export const TIPPFLAECHE_KINDER =
  '[&_button]:relative [&_button]:after:absolute [&_button]:after:left-1/2 [&_button]:after:top-1/2 [&_button]:after:size-11 [&_button]:after:-translate-x-1/2 [&_button]:after:-translate-y-1/2'
