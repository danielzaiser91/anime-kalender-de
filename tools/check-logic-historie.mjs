/**
 * Holt die Git-Historie eines flachen Checkouts einmal, bevor `check:logic` seine Prüfungen parallel startet (17.10.2026).
 * Mehrere Prüfungen, die selbst `git fetch` rufen, stolpern im flachen PR-Checkout über `.git/shallow.lock` (PR 1433).
 * Liefert `null` oder einen Warntext; ob die Historie fehlt, entscheidet die Prüfung, die sie braucht (laut rot).
 */
import { execFileSync } from 'node:child_process'

export function holeHistorie(cwd) {
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  try {
    if (git('rev-parse', '--is-shallow-repository').trim() !== 'true') return null
    git('fetch', '--unshallow', '--filter=blob:none', '--quiet', 'origin')
    return null
  } catch (fehler) {
    return `Historie nicht geholt (${fehler.message.trim()})`
  }
}
