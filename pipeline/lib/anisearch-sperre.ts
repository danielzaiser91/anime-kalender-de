/** Pausen in Minuten, die ein Lauf nach einer Fehlerfolge einlegt, bevor er aufgibt: zusammen 70 Minuten. */
export const PAUSEN_MIN = [10, 20, 40]

export type Folge = { art: 'weiter' } | { art: 'pause'; minuten: number } | { art: 'ende' }

/**
 * Was ein Lauf nach `fehlerInFolge` Fehlschlägen tut. Mit Frist (`restMs` gesetzt) wartet er und fragt danach mit einer einzelnen Anfrage nach,
 * ob die Sperre noch steht — solange die Pause vor der Frist endet. Ohne Frist (kurzer Schritt in einem engen Zeitfenster) endet er sofort,
 * wie bisher. Die Titel, die nicht kamen, bleiben in der Lücke und sind beim nächsten Lauf wieder dran; eine Nichtauskunft wird nie vermerkt.
 */
export function nachFehlern(fehlerInFolge: number, maxFehler: number, pausenGenommen: number, restMs?: number): Folge {
  if (fehlerInFolge < maxFehler) return { art: 'weiter' }
  const minuten = PAUSEN_MIN[pausenGenommen]
  if (restMs === undefined || minuten === undefined || minuten * 60_000 >= restMs) return { art: 'ende' }
  return { art: 'pause', minuten }
}
