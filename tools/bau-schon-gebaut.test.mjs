/**
 * Führt `tools/bau-schon-gebaut-test.sh` aus (Simulation mit Attrappe-gh), damit `check:workflows` den Test über `tests-alle.mjs` mitnimmt.
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const tools = dirname(fileURLToPath(import.meta.url))
// Ausgabe über Pipes weiterreichen: ein geerbtes Anhänge-Handle (Log von prozess-register.mjs) beschreibt bash.exe nicht.
const lauf = spawnSync('bash', [join(tools, 'bau-schon-gebaut-test.sh')], { encoding: 'utf8' })
process.stdout.write(lauf.stdout)
process.stderr.write(lauf.stderr)
process.exit(lauf.status ?? 1)
