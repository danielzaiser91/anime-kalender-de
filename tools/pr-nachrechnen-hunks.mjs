/**
 * Hunk-Rechnung für `pr-nachrechnen-textmerge.mjs` und `pr-nachrechnen-kennung.mjs` (rein, ohne git und ohne Importe: beide Module liegen
 * auf dem Importweg von `pr-nachrechnen-leser-git.mjs`, ein Import dorthin zurück wäre ein Zyklus).
 */
export const ABSTAND = 3
const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/

/** Zeilenbereich eines Hunks: Anzahl 0 (reine Einfügung/Löschung) ist eine Position. */
const bereich = (start, anzahl) => [start, anzahl === 0 ? start : start + anzahl - 1]

/** Hunks einer `git diff -U0`-Ausgabe als { alt, neu } (je [von, bis]). */
export function hunks(diff) {
  return diff.split(/\r?\n/).flatMap((zeile) => {
    const m = HUNK.exec(zeile)
    if (m === null) return []
    return [{ alt: bereich(Number(m[1]), m[2] === undefined ? 1 : Number(m[2])), neu: bereich(Number(m[3]), m[4] === undefined ? 1 : Number(m[4])) }]
  })
}

export const beruehren = (a, b) => a[0] - b[1] <= ABSTAND && b[0] - a[1] <= ABSTAND

/** Frei = beide Seiten haben Hunks und keiner des PR (alt) berührt einen von main (neu). */
export const hunksFrei = (prHunks, mainHunks) => prHunks.length > 0 && mainHunks.length > 0 && !prHunks.some((p) => mainHunks.some((m) => beruehren(p.alt, m.neu)))
