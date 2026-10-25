/** Reine Ecken-Regel der Cover-Messung (ansicht-bild.mjs): rund heißt, die Ecke zeigt den Hintergrund außerhalb des Covers. */
const ECKE_SCHWELLE = 12

const abstand = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0)

/** Farben als [oben links Ecke, oben links außen, unten rechts Ecke, unten rechts außen]; liefert die Fehlertexte. */
export function eckenFehler([ecke, aussen, eckeU, aussenU]) {
  const fehler = []
  if (abstand(ecke, aussen) >= ECKE_SCHWELLE) fehler.push('obere linke Ecke ist nicht rund (Pixel zeigt nicht den Hintergrund)')
  if (abstand(eckeU, aussenU) >= ECKE_SCHWELLE) fehler.push('untere rechte Ecke ist nicht rund')
  return fehler
}
