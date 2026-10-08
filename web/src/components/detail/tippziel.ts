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

/**
 * Standard (WCAG 2.2 SC 2.5.8): Trefferfläche mindestens 24 × 24 px, optisch unverändert — unsichtbares `::after`, braucht `relative`.
 * `TREFFER_24` für kleine runde Knöpfe (20 px), `TREFFER_24_HOCH` nur senkrecht für niedrige Textziele (16 px hoch).
 */
export const TREFFER_24 =
  'relative after:absolute after:left-1/2 after:top-1/2 after:size-6 after:-translate-x-1/2 after:-translate-y-1/2'
export const TREFFER_24_HOCH =
  'relative after:absolute after:inset-x-0 after:top-1/2 after:h-6 after:-translate-y-1/2'
/** Wie `TREFFER_24_HOCH`, aber auch in der Breite mindestens 24 px (Symbole wie „i“ oder „✓“ in der Zeile). */
export const TREFFER_24_MIN =
  'relative after:absolute after:left-1/2 after:top-1/2 after:h-[max(100%,1.5rem)] after:w-[max(100%,1.5rem)] after:-translate-x-1/2 after:-translate-y-1/2'
