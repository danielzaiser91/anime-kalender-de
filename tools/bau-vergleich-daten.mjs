/**
 * Hinweise von `bau-vergleich.mjs` zu den Handdateien unter `data/` (ohne `data/cache/`, das liegt
 * nicht im Repo): Was der Kandidat dort selbst ändert, und was ihm gegenüber der Basis fehlt, weil
 * sein Zweig hinter ihr liegt.
 */

/** Dateien unter `data/`, die `git diff <bereich>` nennt (`von...bis` = nur Änderungen von `bis`). */
function geaendert(git, ...bereich) {
  return git('diff', '--name-only', ...bereich, '--', 'data').split('\n').filter(Boolean)
}

/** Kürzt eine Dateiliste für die Ausgabe. */
const nenne = (dateien) => dateien.slice(0, 5).join(', ') + (dateien.length > 5 ? `, … (+${dateien.length - 5})` : '')

/**
 * Warnung, die immer gilt: Liegt der Kandidat hinter der Basis, baut er mit älteren Handdateien
 * als die Basis, und der Vergleich zeigt dann Änderungen von `main` als Unterschied.
 */
export function zurueckliegtHinweis(git, basis, kandidat) {
  const eigene = new Set(geaendert(git, `${basis}...${kandidat}`))
  const fremde = geaendert(git, basis, kandidat).filter((d) => !eigene.has(d))
  if (!fremde.length) return []
  return [`Hinweis: Der Kandidat liegt hinter der Basis — ${fremde.length} Dateien unter data/ stammen von der Basis, nicht vom Kandidaten (${nenne(fremde)}). Rebasen oder die Basis auf den gemeinsamen Vorfahren setzen.`]
}

/** Hinweis für die Ausgabe „gleich“: Der Kandidat ändert Handdateien, ohne dass der Bau etwas anderes schreibt. */
export function gleichTrotzDatenHinweis(git, basis, kandidat, eigeneDaten) {
  const eigene = geaendert(git, `${basis}...${kandidat}`)
  if (!eigene.length) return []
  const wirkung = eigeneDaten
    ? 'der Kandidat hat sie mitgebaut, der Bau schreibt trotzdem dasselbe'
    : 'sie wurden NICHT mitgebaut (--basisdaten), das „gleich“ sagt nichts über sie'
  return [`Hinweis: data/ unterscheidet sich zwischen Basis und Kandidat in ${eigene.length} Dateien (${nenne(eigene)}); ${wirkung}.`]
}
