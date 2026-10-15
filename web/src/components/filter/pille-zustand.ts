/**
 * **Zustand einer Filter-Pille — eine Quelle für Schnellfilter-Chips, Filter-Pillen im Fenster,
 * aktive Filter und Sprecher-Pillen** (Daniels Wahl V2, 10.10.2026): nur der Rand ist gefärbt.
 * Gewählt = grüner Rand (2 px) mit heller Füllung, ausgeschlossen = roter Rand, Text durchgestrichen.
 * Der zweite Pixel kommt als `inset-ring`, damit die Pille nicht breiter wird und neben dem Fokusring bestehen bleibt.
 * Der Text bleibt in Textfarbe (gewählt) bzw. `ak-fehler-text` (ausgeschlossen), beide ≥ 4,5 : 1 auf der Füllung.
 */
export const PILLE_JA =
  'border-ak-gut bg-ak-gut-grund inset-ring-1 inset-ring-ak-gut font-bold text-ak-text'

export const PILLE_NEIN =
  'border-ak-fehler bg-ak-fehler-grund inset-ring-1 inset-ring-ak-fehler text-ak-fehler-text line-through decoration-ak-fehler/70'
