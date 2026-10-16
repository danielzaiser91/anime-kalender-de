/**
 * Ausnahmen der Trefferprobe (`trefferprobe-browser.mjs`): Bedienelemente, die absichtlich nicht oben liegen.
 * Jede Ausnahme nennt den Waehler und den Grund; nichts pauschal.
 */
export const AUSNAHMEN = [
  {
    waehler: 'button.ak-oeffnen.sr-only',
    grund: 'Unsichtbarer Tastatur- und Screenreader-Knopf der Karte (1 × 1 px); mit der Maus öffnet die ganze Karte (onClick am article).',
  },
]
