/**
 * Textmerge-Stufe für `pr-nachrechnen.mjs` (13.11.2026, Ansatz G): Eine Datei, die main seit dem Kettenlauf bewegte und die der PR ebenfalls
 * ändert, entwertet die Kette nur, wenn sich beide Änderungen wirklich berühren: `git merge-tree` meldet einen Konflikt, oder Hunks von PR
 * und main in derselben Datei liegen höchstens `ABSTAND` Zeilen auseinander. Sonst fügt Git beide Änderungen unabhängig zusammen (Hotspots:
 * tools/check-logic-liste.txt, docs/wissen/*.md, Skills; 12.–13.11.2026: 68 Neustarts an 33 PRs).
 * Beide Hunk-Listen stehen in Zeilen von main: PR-Hunks aus `main..Test-Merge` (alte Seite), main-Hunks aus `basis..main` (neue Seite).
 * Fail-closed: ohne Hunks (Binärdatei, Moduswechsel, Löschung), bei Konflikt oder Git-Fehler bleibt die Datei ein Grund.
 */
import { gitAufruf } from './pr-nachrechnen-leser-git.mjs'

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

/** Test-Merge von main und Kopf; null bei Konflikt (Exit 1), sonst die Baum-ID. Andere Fehler werfen. */
function testMerge(git, main, kopf) {
  try {
    return git(['merge-tree', '--write-tree', main, kopf]).split(/\r?\n/)[0]
  } catch (e) {
    if (e.status === 1) return null
    throw e
  }
}

/**
 * Textmerge-Stufe über echtem git: (refs { nummer, kopf, main, basis }, dateien) -> Set der Dateien, die nicht entwerten.
 * Jeder Fehler (Fetch, git zu alt für `--write-tree`) ergibt die leere Menge: dann bleibt es bei der bisherigen Regel.
 */
export const textmergeFrei = (git) => (refs, dateien) => {
  try {
    git(['fetch', '-q', 'origin', `refs/pull/${refs.nummer}/head`, refs.main, refs.basis])
    const baum = testMerge(git, refs.main, refs.kopf)
    if (baum === null) return new Set()
    const diff = (von, bis, datei) => git(['diff', '-U0', '--no-renames', von, bis, '--', datei])
    return new Set(dateien.filter((d) => hunksFrei(hunks(diff(refs.main, baum, d)), hunks(diff(refs.basis, refs.main, d)))))
  } catch {
    return new Set()
  }
}

export const standardTextmerge = textmergeFrei(gitAufruf)
