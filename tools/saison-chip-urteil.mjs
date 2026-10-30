/**
 * Urteilsregeln der Saison-Karte mit Anbieter-Chips (Handy 360 px): reine Funktionen aus Messwerten, getestet in `saison-chip-urteil.test.mjs`.
 * Die Messung im Browser steht in `ansicht-saison-chip.mjs`.
 */

/** Mindestgröße des Tippziels (die ganze Karte ist ein Knopf). */
export const MIN_KNOPF = 44

/**
 * Urteil über eine Karte. `karte`: { knopfHoehe, knopfRechts, chipsRechts (Liste), zeileRechts (oder null), gestrichelt (Anzahl Chips), laut (Karte trägt die Zeile) }.
 * `erwartet`: 'gekennzeichnet' oder 'belegt'.
 */
export function urteilKarte(karte, erwartet) {
  const f = []
  if (karte.knopfHoehe < MIN_KNOPF) f.push(`Karte ${karte.knopfHoehe} px hoch (< ${MIN_KNOPF})`)
  if (karte.chipsRechts.some((r) => r > karte.knopfRechts + 0.5)) f.push('ein Chip ragt über den Rand der Karte')
  if (karte.zeileRechts !== null && karte.zeileRechts > karte.knopfRechts + 0.5) f.push('die Zeile „laut Anbieter“ ragt über den Rand der Karte')
  if (erwartet === 'gekennzeichnet' && !(karte.laut && karte.gestrichelt > 0)) f.push('gekennzeichnete Karte ohne gestrichelten Chip und Zeile')
  if (erwartet === 'belegt' && (karte.laut || karte.gestrichelt > 0)) f.push('belegte Karte trägt Kennzeichnung')
  return f
}

/** Urteil über die Seite: kein seitlicher Überlauf. */
export function urteilSeite(scrollBreite, fensterBreite) {
  return scrollBreite > fensterBreite ? [`Seite ${scrollBreite - fensterBreite} px zu breit`] : []
}
