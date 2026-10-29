/**
 * Reine Regeln der Abzeichen-Messung (`ansicht-abzeichen.mjs`): das Abzeichen „angekündigt“ oben links auf der Datenbank-Kachel.
 * Eingaben sind Zahlen und Farben aus der gebauten App, keine Klassennamen.
 */

/** Summe der Farbkanal-Unterschiede, ab der zwei Pixel als verschieden gelten (wie `ECKE_SCHWELLE` in `ecken-urteil.mjs`). */
export const PIXEL_VERSCHIEDEN = 12
/** Kleinster Abstand des Abzeichens zum Kachelrand (1 px Rand plus `left-1 top-1`) und zum Streifen unten, in px. */
export const MIN_RAND = 4
export const MIN_LUFT_STREIFEN = 4

const abstand = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0)

/**
 * Lage in Kachelkoordinaten. `k`, `a`, `s`: { l, t, r, b } der Kachel, des Abzeichens und des Streifens.
 * Liefert die Fehlertexte.
 */
export function lageFehler({ k, a, s }) {
  const fehler = []
  if (a.l - k.l < MIN_RAND) fehler.push(`Abzeichen links nur ${a.l - k.l} px vom Kachelrand`)
  if (a.t - k.t < MIN_RAND) fehler.push(`Abzeichen oben nur ${a.t - k.t} px vom Kachelrand`)
  if (k.r - a.r < MIN_RAND) fehler.push(`Abzeichen rechts nur ${k.r - a.r} px vom Kachelrand`)
  if (s.t - a.b < MIN_LUFT_STREIFEN) fehler.push(`Abzeichen nur ${s.t - a.b} px über dem Streifen`)
  return fehler
}

/**
 * Pixel mit und ohne Abzeichen (dieselbe Kachel, Abzeichen einmal ausgeblendet). `gleich`: Name → [mit, ohne], muss unverändert sein
 * (Kachelecken, Unterkante der Kachel, die Zeile unter dem Abzeichen, die Pixel außerhalb seiner Ecken); `sichtbar`: [mit, ohne],
 * muss sich unterscheiden (das Abzeichen ist wirklich da). Liefert die Fehlertexte.
 */
export function pixelFehler({ gleich, sichtbar }) {
  const fehler = []
  for (const [name, [mit, ohne]] of Object.entries(gleich)) {
    if (abstand(mit, ohne) >= PIXEL_VERSCHIEDEN) fehler.push(`${name} ändert sich durch das Abzeichen (${mit} statt ${ohne})`)
  }
  if (abstand(...sichtbar) < PIXEL_VERSCHIEDEN) fehler.push('die Mitte des Abzeichens gleicht dem Cover darunter (nicht sichtbar)')
  return fehler
}
