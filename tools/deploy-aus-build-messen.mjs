/**
 * Trefferquote von „Deploy aus Build“ an der echten Historie: Für die letzten N PR-Merges auf main wird der Baum rekonstruiert, den der
 * letzte grüne Lauf der PR-Prüfkette gebaut hat (Merge-Ref = main zum Laufstart + PR-Kopf, `git merge-tree`), und mit dem Baum des
 * Merge-Commits verglichen. Gegenprobe 16.10.2026: für Lauf 38936051433 und 38936171907 gleich dem `baum` in `version.json` des Artefakts.
 * Aufruf (lesend, nur git und gh): node tools/deploy-aus-build-messen.mjs [N=20]
 */
import { execFileSync } from 'node:child_process'
import { githubUnbedenklich } from './deploy-aus-build.mjs'

const REPO = 'danielzaiser91/anime-kalender-de'
const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const api = (pfad) => JSON.parse(execFileSync('gh', ['api', pfad], { encoding: 'utf8', maxBuffer: 1 << 28 }))
const zeilen = (text) => text.split('\n').filter(Boolean)

/** Baum, den der letzte erfolgreiche Lauf der Kette für diesen PR gebaut hat, oder null ohne solchen Lauf. */
function gebauterBaum(nummer, merge) {
  const kopf = api(`repos/${REPO}/pulls/${nummer}`).head.sha
  try {
    git(['cat-file', '-e', kopf])
  } catch {
    git(['fetch', '-q', 'origin', `pull/${nummer}/head`])
  }
  const laeufe = api(`repos/${REPO}/actions/workflows/pr-pruefung.yml/runs?head_sha=${kopf}&event=pull_request&per_page=20`).workflow_runs
  const lauf = laeufe.filter((l) => l.conclusion === 'success').sort((a, b) => b.id - a.id)[0]
  if (!lauf) return null
  const basis = git(['rev-list', '-1', '--first-parent', `--before=${lauf.run_started_at}`, `${merge}^`])
  return { lauf: lauf.id, baum: zeilen(git(['merge-tree', '--write-tree', basis, kopf]))[0] }
}

/** Ein Merge: Treffer nach alter Regel (.github/ unverändert) und nach neuer (`githubUnbedenklich`), dazu die abweichenden Pfade. */
function messeMerge(nummer, merge) {
  const gebaut = gebauterBaum(nummer, merge)
  const github = zeilen(git(['diff', '--no-renames', '--name-only', `${merge}~1`, merge, '--', '.github']))
  const pfade = gebaut ? zeilen(git(['diff', '--name-only', gebaut.baum, `${merge}^{tree}`])) : ['kein Lauf']
  const baumGleich = pfade.length === 0
  return { nummer, lauf: gebaut?.lauf, vorher: baumGleich && github.length === 0, nachher: baumGleich && githubUnbedenklich(github), github, pfade }
}

const anzahl = Number(process.argv[2] ?? 20)
const merges = zeilen(git(['log', '--first-parent', 'origin/main', '--format=%H %s', '-400']))
  .map((z) => [z.match(/\(#(\d+)\)$/)?.[1], z.slice(0, 40)])
  .filter(([nummer]) => nummer)
  .slice(0, anzahl)
const ergebnisse = merges.map(([nummer, merge]) => messeMerge(nummer, merge))
for (const e of ergebnisse) {
  const gruppen = [...new Set(e.pfade.map((p) => p.split('/').slice(0, p.startsWith('public/') ? 2 : 1).join('/')))]
  console.log(`#${e.nummer} Lauf ${e.lauf ?? '-'} vorher ${e.vorher ? 'T' : '-'} nachher ${e.nachher ? 'T' : '-'} .github: ${e.github.join(' ') || '-'} | weicht ab: ${gruppen.join(' ') || '-'}`)
}
const zaehle = (k) => ergebnisse.filter((e) => e[k]).length
console.log(`Treffer vorher ${zaehle('vorher')}/${ergebnisse.length}, nachher ${zaehle('nachher')}/${ergebnisse.length}`)
