/**
 * Führt jede `tools/*.test.mjs` nacheinander mit node aus (alphabetisch, erster Fehler bricht ab).
 * Läuft in `npm run check:workflows`. Eine neue Test-Datei ist damit ohne Eintrag in `package.json` dabei:
 * die lange `&&`-Kette dort war die Stelle, an der jeder PR mit neuem Test mit den anderen kollidierte.
 */
import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const tools = dirname(fileURLToPath(import.meta.url))
const wurzel = join(tools, '..')
const tests = readdirSync(tools).filter((f) => f.endsWith('.test.mjs')).sort()

for (const test of tests) {
  console.log(`[tests-alle] tools/${test}`)
  const lauf = spawnSync(process.execPath, [join(tools, test)], { cwd: wurzel, stdio: 'inherit' })
  if (lauf.status !== 0) {
    console.error(`tests-alle: tools/${test} ist rot.`)
    process.exit(lauf.status ?? 1)
  }
}
console.log(`tests-alle: ${tests.length} von ${tests.length} Tests grün.`)
