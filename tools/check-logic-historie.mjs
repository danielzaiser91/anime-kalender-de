/**
 * Holt die Git-Historie eines flachen Checkouts einmal, bevor `check:logic` seine Prüfungen parallel startet (17.10.2026).
 * Mehrere Prüfungen, die selbst `git fetch` rufen, stolpern im flachen PR-Checkout über `.git/shallow.lock` (PR 1433).
 * Liefert eine Ergebniszeile oder einen Warntext; ob die Historie fehlt, entscheidet die Prüfung, die sie braucht (laut rot).
 */
import { execFileSync } from 'node:child_process'

/** `{ warnung, zeile }`: genau eines davon ist gesetzt (Warntext mit Grund, sonst die Ergebniszeile für das Log). */
export function historieErgebnis(cwd) {
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  try {
    if (git('rev-parse', '--is-shallow-repository').trim() !== 'true') return { warnung: null, zeile: 'Historie vorhanden (Checkout nicht flach)' }
    git('fetch', '--unshallow', '--filter=blob:none', '--quiet', 'origin')
    return { warnung: null, zeile: 'Historie geholt (flach → vollständig)' }
  } catch (fehler) {
    return { warnung: `Historie nicht geholt (${fehler.message.trim()})`, zeile: null }
  }
}

export function holeHistorie(cwd) {
  return historieErgebnis(cwd).warnung
}
