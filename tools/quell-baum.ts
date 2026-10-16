import { execFileSync } from 'node:child_process'

/** Git-Baum des ausgecheckten Stands (`HEAD^{tree}`), leer ohne Git. Er steht in `version.json` und beweist dem Deploy, aus welchem Quelltext der Bau stammt. */
export function quellBaum(): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}
