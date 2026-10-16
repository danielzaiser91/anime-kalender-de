/**
 * Cover-Vorschau beim Zeigen auf eine Listenzeile (Im Handel, Im Fernsehen): Größe, Frist und Lage.
 * Die Vorschau hängt als `fixed`-Karte am `body`, die Zeile selbst ändert ihre Größe nie (kein Layout-Sprung).
 */
export const VORSCHAU_BREITE = 120
export const VORSCHAU_HOEHE = 170
/** Erst nach dieser Frist (ms) mit ruhendem Zeiger wird das Bild angefordert — Durchfahren der Liste kostet keine Bytes. */
export const VORSCHAU_FRIST_MS = 150

const ABSTAND = 16
const RAND = 8

/** Nur Maus und Stift zeigen; ein Tipp am Handy löst eine Zeigerberührung aus, die keine Vorschau und keinen Abruf wert ist. */
export function zeigtVorschau(zeigerart: string): boolean {
  return zeigerart === 'mouse' || zeigerart === 'pen'
}

export interface VorschauLage {
  left: number
  top: number
}

/** Rechts neben dem Zeiger (am rechten Rand links davon), unter der Zeile — sonst darüber —, damit sie den Titel nicht verdeckt; im Fenster gehalten. */
export function vorschauLage(
  zeile: { top: number; bottom: number },
  zeigerX: number,
  fenster: { breite: number; hoehe: number },
): VorschauLage {
  const rechts = zeigerX + ABSTAND
  const left = rechts + VORSCHAU_BREITE <= fenster.breite - RAND ? rechts : Math.max(RAND, zeigerX - ABSTAND - VORSCHAU_BREITE)
  const unten = zeile.bottom + RAND
  const top = unten + VORSCHAU_HOEHE <= fenster.hoehe - RAND ? unten : Math.max(RAND, zeile.top - RAND - VORSCHAU_HOEHE)
  return { left, top }
}
