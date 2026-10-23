/**
 * Regel für tools/check-logic-liste.txt und tools/check-bestand-liste.txt: Einträge (ohne Leer- und
 * #-Kommentarzeilen) sind nach UTF-16-Code sortiert (`-` vor `.`, wie `LC_ALL=C sort`) und einmalig.
 * Von check-logic-alle.mjs und pr-vorpruefung.mjs gemeinsam genutzt.
 */

/** Einträge einer Liste: getrimmt, ohne Leerzeilen und Kommentarzeilen. */
export function listenEintraege(text) {
  return text
    .split(/\r?\n/)
    .map((z) => z.trim())
    .filter((z) => z && !z.startsWith('#'))
}

/** Fehltexte (leer = in Ordnung): erster zu früh stehender Eintrag, erster doppelter Eintrag. */
export function listenFehler(dateien, name) {
  const fehler = []
  const unsortiert = dateien.find((d, i) => i > 0 && d < dateien[i - 1])
  if (unsortiert) fehler.push(`${name} muss alphabetisch sortiert sein (${unsortiert} steht zu früh; Code-Reihenfolge wie LC_ALL=C, „-“ vor „.“).`)
  const doppelt = dateien.find((d, i) => dateien.indexOf(d) !== i)
  if (doppelt) fehler.push(`${doppelt} steht mehrfach in ${name}: eine Zeile streichen.`)
  return fehler
}
