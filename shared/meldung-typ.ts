import type { Quelle } from './types.ts'

/**
 * Eine Meldung, aus der sich **kein** genauer Termin herauslesen ließ.
 *
 * Der Anlass ist eine Messung, keine Vermutung (14.08.2026): Von 29 aktuellen
 * Anime2You-Meldungen enthielt **keine einzige** ein Datum auf den Tag genau,
 * 27 nannten nur einen Monat. Für die halbe Anbieterlandschaft — Netflix,
 * Disney+, Prime Video, WOW, Joyn, RTL+, Kino, Disc — ist Anime2You aber die
 * einzige Quelle.
 *
 * Solche Funde verschwinden bisher in `data/proposals/` und warten auf einen
 * Menschen. Stattdessen werden sie jetzt gezeigt: „Diese Quelle sagt etwas über
 * einen Termin, wir konnten ihn nicht sicher auslesen — hier steht es." Das ist
 * ehrlicher als Schweigen und nützlicher als ein leerer Kalender.
 */
export interface Meldung {
  titleId: number
  quelle: Quelle
  /** Überschrift der Meldung. */
  titel: string
  /** Der Textausschnitt mit der Terminangabe — zum Selbstnachlesen. */
  zitat?: string
  /** „2026-09", wenn nur ein Monat genannt wurde. */
  monat?: string
  /** Erscheinungstag der Meldung. */
  datum: string
}
