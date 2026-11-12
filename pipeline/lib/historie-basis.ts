/**
 * Der Git-Stand, gegen den die Wache einen Befund aufschlüsselt (Titel, Wege, Linkprüfung).
 *
 * Läuft der Bau direkt nach einem Bau-Commit, trägt `HEAD` schon die Änderung, die die vorige Zeile noch nicht kannte
 * (10.11.2026 16:55, Sailor Moon Crystal III: Kennzahl rot, aber keine Titelzeile, weil `HEAD` und Arbeitsbaum gleich waren).
 * Deshalb steht in jeder Zeile der `basis`-Commit der Messung, und die nächste Messung schlüsselt gegen diesen auf.
 */
import { execFileSync } from 'node:child_process'

const SHA = /^[0-9a-f]{7,40}$/

function git(wurzel: string, args: string[]): string | undefined {
  try {
    return execFileSync('git', args, { cwd: wurzel, encoding: 'utf8', timeout: 30000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return undefined
  }
}

/** Der Commit, auf dem gerade gemessen wird; ohne Git undefined. */
export function kopfCommit(wurzel: string): string | undefined {
  const sha = git(wurzel, ['rev-parse', 'HEAD'])
  return sha && SHA.test(sha) ? sha : undefined
}

/** `basis` der vorigen Zeile, wenn sie gesetzt ist und im Klon vorliegt (flacher Klon!); sonst `HEAD`. */
export function aufschluesselStand(wurzel: string, vorher: object | null): string {
  const basis = (vorher as { basis?: unknown } | null)?.basis
  if (typeof basis !== 'string' || !SHA.test(basis)) return 'HEAD'
  return git(wurzel, ['cat-file', '-e', `${basis}^{commit}`]) === undefined ? 'HEAD' : basis
}
