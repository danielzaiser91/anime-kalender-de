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
  for (const rel of ['node_modules', join('data', 'cache')]) {
    if (!existsSync(join(haupt, rel))) continue
    symlinkSync(join(haupt, rel), join(pfad, rel), 'junction')
    verknuepft.push(join(pfad, rel))
  }
  let weg = false
  const aufraeumen = () => {
    if (weg) return
    weg = true
    for (const j of verknuepft) junctionLoesen(j)
    git(haupt, ['worktree', 'remove', '--force', pfad])
    git(haupt, ['branch', '-D', zweig])
  }
  return { pfad, zweig, aufraeumen }
}
