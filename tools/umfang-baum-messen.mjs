/**
 * Kindprozess von `pr-nachrechnen-umfang.mjs`: misst `umfang-pruefen` an einem git-Baum (Merge-Stand eines PR) ohne Arbeitsbaum.
 * Eigener Prozess, weil `umfang-pruefen` das Paket `typescript` lädt und der Nacht-Merger ohne `npm ci` läuft: fehlt es,
 * scheitert nur dieses Kind (Exit 1, Ursache auf stderr) und der Aufrufer meldet „nicht ermittelbar“.
 *
 * Aufruf (im Repo): node tools/umfang-baum-messen.mjs <baum> <main>
 * Ausgabe: JSON-Liste der Verstöße gegen die Grenzen, die `tools/umfang-grenzen.json` auf <main> erlaubt (leer = in Ordnung).
 */
import { pathToFileURL } from 'node:url'
import { gitAufruf, inhalte } from './pr-nachrechnen-leser-git.mjs'
import { BEREICHE, gegenGrenzen, istVermessen, vermessen } from './umfang-pruefen.mjs'

const GRENZEN = 'tools/umfang-grenzen.json'

/** Verstöße des Baums `baum` gegen die Grenzen auf `main`; `git` wie in `gitLeser`. */
export function verstoesse(git, baum, main) {
  const liste = git(['ls-tree', '-r', '-z', '--name-only', baum, '--', ...BEREICHE]).split('\0').filter((p) => p !== '' && istVermessen(p))
  const texte = inhalte(git, baum, liste)
  const erlaubt = JSON.parse(inhalte(git, main, [GRENZEN]).get(GRENZEN))
  return gegenGrenzen(vermessen([...texte.keys()], (p) => texte.get(p)).stand, erlaubt).zuViel
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(verstoesse(gitAufruf, process.argv[2], process.argv[3])))
  } catch (e) {
    console.error(`umfang-baum-messen: ${String(e.message).split('\n')[0].slice(0, 200)}`)
    process.exit(1)
  }
}
