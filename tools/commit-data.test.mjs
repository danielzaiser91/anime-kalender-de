/**
 * Führt `tools/commit-data-test.sh` aus (Simulation von `commit-data.sh` mit Attrappe-npm), damit `check:workflows` den Test über `tests-alle.mjs` mitnimmt.
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const tools = dirname(fileURLToPath(import.meta.url))
const lauf = spawnSync('bash', [join(tools, 'commit-data-test.sh')], { stdio: 'inherit' })
process.exit(lauf.status ?? 1)
