/**
 * Urteil über einen Tastaturversuch am Such-Icon (Issue 4072), reine Funktion ohne Browser.
 * `r`: erreicht (Tab fand das Icon), ziel (Fokus-Ziel nach der Taste), escape (Escape gedrückt?),
 * nachEscape (aria-label des Fokus nach Escape), feldNoch (Suchfeld nach Escape noch sichtbar?).
 * Rückgabe: Leerstring = ok, sonst der Grund.
 */
export function tasteUrteil(r) {
  if (!r.erreicht) return 'Tab erreicht das Icon nicht'
  if (r.ziel !== 'feld') return `${r.taste} fokussiert das Feld nicht (${r.ziel})`
  if (!r.escape) return ''
  if (r.nachEscape !== 'Suche öffnen') return `Escape: Fokus auf ${r.nachEscape}, nicht am Icon`
  if (r.feldNoch) return 'Escape: Feld bleibt offen'
  return ''
}
