/**
 * Textmerge-Stufe für `pr-nachrechnen.mjs` (13.11.2026, Ansatz G): Eine Datei, die main seit dem Kettenlauf bewegte und die der PR ebenfalls
 * ändert, entwertet die Kette nur, wenn sich beide Änderungen wirklich berühren: `git merge-tree` meldet einen Konflikt, oder Hunks von PR
 * und main in derselben Datei liegen höchstens `ABSTAND` Zeilen auseinander. Sonst fügt Git beide Änderungen unabhängig zusammen (Hotspots:
 * tools/check-logic-liste.txt, docs/wissen/*.md, Skills; 12.–13.11.2026: 68 Neustarts an 33 PRs).
 * Beide Hunk-Listen stehen in Zeilen von main: PR-Hunks aus `main..Test-Merge` (alte Seite), main-Hunks aus `basis..main` (neue Seite).
 * Fail-closed: ohne Hunks (Binärdatei, Moduswechsel, Löschung), bei Konflikt oder Git-Fehler bleibt die Datei ein Grund.
 */
import { hunks, hunksFrei } from './pr-nachrechnen-hunks.mjs'
import { gitAufruf } from './pr-nachrechnen-leser-git.mjs'

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
