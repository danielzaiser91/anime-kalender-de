/**
 * Reine Regeln der Messung der Karte „Termin offen“ (`ansicht-termin-karte.mjs`): Lage gegen den Kasten, Tippziele, Ecken und Unterkante.
 * Eingaben sind Zahlen und Farben aus der gebauten App, keine Klassennamen.
 */
import { eckenFehler } from './ecken-urteil.mjs'

/** Summe der Farbkanal-Unterschiede, ab der zwei Pixel als verschieden gelten (wie `ECKE_SCHWELLE` in `ecken-urteil.mjs`). */
export const PIXEL_VERSCHIEDEN = 12
export const MIN_TIPPFLAECHE = 43.5
/** Kleinster Abstand zwischen Kasten und Karte in px (die Karte hängt mit `mt-3` darunter). */
export const MIN_ABSTAND = 8

const abstand = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0)

/** `karte`, `kasten`: { l, r, t, b } in Seitenkoordinaten; `breite`: Fensterbreite; `knoepfe`: Höhen von Knopf und Quelle. Liefert die Fehlertexte. */
export function lageFehler({ karte, kasten, breite, knoepfe }) {
  const fehler = []
  if (Math.abs(karte.l - kasten.l) > 1 || Math.abs(karte.r - kasten.r) > 1) fehler.push(`Karte (${karte.l}–${karte.r}) steht nicht bündig zum Kasten (${kasten.l}–${kasten.r})`)
  if (karte.l < 0 || karte.r > breite) fehler.push(`Karte ragt aus dem Fenster (${karte.l}–${karte.r} von ${breite} px)`)
  if (karte.t - kasten.b < MIN_ABSTAND) fehler.push(`Karte nur ${karte.t - kasten.b} px unter dem Kasten`)
  for (const [name, h] of Object.entries(knoepfe)) if (h < MIN_TIPPFLAECHE) fehler.push(`${name} nur ${h} px hoch`)
  return fehler
}

/**
 * Pixel: `ecken` wie in `eckenFehler` (Ecke, Außenpixel, Ecke unten rechts, Außenpixel); `rand`: die Randzeile mit dem größten Abstand zum Grund
 * (Farbe), `grund`: Farbe daneben, `darunter`: Zeile 2 px unter der Karte. Der Rand muss sich vom Grund abheben, darunter ist nur Grund.
 */
export function pixelFehler({ ecken, rand, grund, darunter }) {
  const fehler = eckenFehler(ecken)
  if (abstand(rand, grund) < PIXEL_VERSCHIEDEN) fehler.push('die Unterkante der Karte hebt sich nicht vom Grund ab (kein Rand sichtbar)')
  if (abstand(darunter, grund) >= PIXEL_VERSCHIEDEN) fehler.push('unter der Unterkante der Karte liegt noch etwas anderes als der Grund')
  return fehler
}
