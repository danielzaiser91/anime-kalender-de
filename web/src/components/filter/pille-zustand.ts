/**
 * **Zustand einer Filter-Pille — eine Quelle für Schnellfilter-Chips, Filter-Pillen im Fenster,
 * aktive Filter und Sprecher-Pillen** (Daniels Wahl V2, 10.10.2026): nur der Rand ist gefärbt.
 * Gewählt = grüner Rand (2 px) mit heller Füllung, ausgeschlossen = roter Rand, Text durchgestrichen.
 * Der zweite Pixel kommt als `inset-ring`, damit die Pille nicht breiter wird und neben dem Fokusring bestehen bleibt.
 * Der Text bleibt in Textfarbe (gewählt) bzw. `rose-700`/`rose-300` (ausgeschlossen), beide ≥ 4,5 : 1 auf der Füllung.
 */
export const PILLE_JA =
  'border-ak-gut bg-ak-gut-grund inset-ring-1 inset-ring-ak-gut font-bold text-ak-text'

export const PILLE_NEIN =
  'border-rose-500 bg-rose-500/10 inset-ring-1 inset-ring-rose-500 text-rose-700 line-through decoration-rose-500/70 dark:border-rose-400 dark:inset-ring-rose-400 dark:text-rose-300'
