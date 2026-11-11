/**
 * Läuft IM Rahmen der Bühne: der Name einer Terminzeile ist gekappt („ProSieben …"), wenn sein Text breiter ist als sein Kasten.
 * Gemessen wird `scrollWidth > clientWidth` an jedem Namen einer Terminzeile (`data-termin-name`).
 * Gibt je gekapptem Namen `{ text, platz, noetig }` zurück; eine leere Liste heißt: nichts abgeschnitten.
 * Eigenständig (keine Importe), weil `evaluate` die Funktion als Text in den Rahmen schickt.
 */
export function gekappteNamenImRahmen() {
  return [...document.querySelectorAll('[data-termin-name]')]
    .filter((e) => e.scrollWidth > e.clientWidth + 1)
    .map((e) => ({ text: (e.textContent ?? '').trim(), platz: e.clientWidth, noetig: e.scrollWidth }))
}

/** Urteil über die Messung je Zelle (`{ schluessel, gekappt }`): die Zeilen der Befunde, leer = in Ordnung. */
export function kappungsBefunde(zellen) {
  return zellen.flatMap(({ schluessel, gekappt }) => gekappt.map((g) => `${schluessel}: „${g.text}“ gekappt (${g.platz} von ${g.noetig} px)`))
}
