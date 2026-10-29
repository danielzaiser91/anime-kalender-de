import type { Phase } from './empfehlung-ablauf.ts'

export type Abschnitt = 'einleitung' | 'fortsetzen' | 'duell' | 'ergebnis' | 'leinwand' | 'nichts'

export interface Zeichenlage {
  /** Ob die Daten geladen sind. */
  kontext: boolean
  phase: Phase
  /** Ob ein Duellstand da ist (fehlt bei gemerkten Vorschlägen nach neuem Pool). */
  sitzung: boolean
  fortsetzbar: boolean
  /** Ob auf der Leinwand ein Titel gewählt ist. */
  aktuell: boolean
}

/** Welcher Abschnitt von „Entdecken“ in dieser Lage gezeichnet wird; die Ansicht und ihre Prüfung nutzen dieselbe Entscheidung. */
export function zeichnung(l: Zeichenlage): Abschnitt {
  if (!l.kontext) return 'nichts'
  if (l.phase === 'start') return l.fortsetzbar ? 'fortsetzen' : 'einleitung'
  if (l.phase === 'duell') return l.sitzung ? 'duell' : 'nichts'
  if (l.phase === 'ergebnis') return 'ergebnis'
  return l.aktuell ? 'leinwand' : 'nichts'
}
