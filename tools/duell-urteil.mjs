import { eckenFehler } from './ecken-urteil.mjs'

/**
 * Reine Regel der Duell-Messung (`ansicht-duell.mjs`): Karte A im Duell ohne Wahl, als Sieger und als Verlierer.
 * Je Zustand `{ unten, farben }`: `unten` ist die gerundete Unterkante der Karte, `farben` sind fünf Pixel
 * [Ecke oben links, außen daneben, Ecke unten rechts, außen daneben, zwei Pixel unter der Unterkante in der Mitte].
 */
const RING_SICHTBAR = 40

const abstand = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0)

export function duellFehler({ ohne, gewinnt, verliert }) {
  const fehler = []
  for (const [name, z] of Object.entries({ ohne, gewinnt, verliert })) {
    for (const f of eckenFehler(z.farben)) fehler.push(`${name}: ${f}`)
    if (z.unten !== ohne.unten) fehler.push(`${name}: Unterkante der Karte verschiebt sich (${ohne.unten} → ${z.unten})`)
  }
  for (const [name, z] of Object.entries({ gewinnt, verliert })) {
    if (abstand(z.farben[4], ohne.farben[4]) < RING_SICHTBAR) fehler.push(`${name}: Ring unter der Unterkante fehlt (abgeschnitten)`)
  }
  if (abstand(gewinnt.farben[4], verliert.farben[4]) < RING_SICHTBAR) fehler.push('Sieger- und Verlierer-Ring unten haben dieselbe Farbe')
  return fehler
}

/**
 * Die fünf Messpunkte zu einem Rechteck mit Nachkommastellen (`getBoundingClientRect`): das erste Pixel, dessen Mitte noch in der Karte liegt,
 * je an der oberen linken und unteren rechten Ecke samt dem Pixel schräg außerhalb, dazu die Mitte zwei Pixel unter der Unterkante.
 */
export function messpunkte({ x, y, w, h }) {
  const links = Math.floor(x - 0.5) + 1
  const oben = Math.floor(y - 0.5) + 1
  const rechts = Math.ceil(x + w - 0.5) - 1
  const unten = Math.ceil(y + h - 0.5) - 1
  return [[links, oben], [links - 1, oben - 1], [rechts, unten], [rechts + 1, unten + 1], [Math.round(x + w / 2), Math.floor(y + h) + 2]]
}
