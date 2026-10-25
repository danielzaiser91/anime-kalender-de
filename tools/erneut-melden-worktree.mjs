/**
 * Eigener Arbeitsbaum für `erneut-melden.mjs`: Zweig, Commit, Push und PR entstehen dort, der Hauptordner bleibt unberührt
 * (20.10.2026: der Hauptordner darf laut `hauptordner-sperre.js` nur lesen und `git pull --ff-only`; ein Abbruch ließ dort Änderungen liegen).
 */
import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, unlinkSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })

/** Löst eine Junction, ohne das Ziel anzufassen (ein `rm -r` leerte sonst den Hauptordner-`node_modules`). */
function junctionLoesen(pfad) {
  if (existsSync(pfad) && lstatSync(pfad).isSymbolicLink()) unlinkSync(pfad)
}

/**
 * Legt `<haupt>/_wt-erneut-melden-<stempel>` auf `origin/main` mit neuem Zweig `erneut-melden/<stempel>` an
 * (Junctions für `node_modules` und `data/cache`, falls der Hauptordner sie hat). `aufraeumen` ist wiederholbar.
 */
export function legeWorktreeAn(haupt, stempel) {
  const pfad = join(haupt, `_wt-erneut-melden-${stempel}`)
  const zweig = `erneut-melden/${stempel}`
  git(haupt, ['fetch', '-q', 'origin', 'main'])
  git(haupt, ['worktree', 'add', '-q', '-b', zweig, pfad, 'origin/main'])
  const verknuepft = []
  let weg = false
  const aufraeumen = () => {
    if (weg) return
    weg = true
    for (const j of verknuepft) junctionLoesen(j)
    git(haupt, ['worktree', 'remove', '--force', pfad])
    git(haupt, ['branch', '-D', zweig])
  }
  /* Scheitert eine Junction, bliebe sonst ein Arbeitsbaum samt Zweig ohne Meldung liegen. */
  try {
    for (const rel of ['node_modules', join('data', 'cache')]) {
      if (!existsSync(join(haupt, rel))) continue
      symlinkSync(join(haupt, rel), join(pfad, rel), 'junction')
      verknuepft.push(join(pfad, rel))
    }
  } catch (fehler) {
    aufraeumen()
    throw fehler
  }
  return { pfad, zweig, aufraeumen }
}

/**
 * Hinweis für einen Abbruch nach dem Push, aber vor der PR-Anlage: der Zweig liegt dann auf origin.
 * Er wird nur gemeldet, nie gelöscht (hängt doch ein PR daran, würde das Löschen ihn schließen). `null`: nichts liegen geblieben.
 */
export function restzweigHinweis(cwd, zweig) {
  let liste = ''
  try {
    liste = git(cwd, ['ls-remote', '--heads', 'origin', zweig])
  } catch {
    return `Ob der Zweig ${zweig} auf origin liegt, ließ sich nicht prüfen: git ls-remote --heads origin ${zweig}`
  }
  if (!liste.trim()) return null
  return `Zweig ${zweig} liegt auf origin, ohne dass ein Pull Request angelegt wurde (prüfen: gh pr list --head ${zweig}). Löschen: git push origin --delete ${zweig}`
}
