/**
 * Führt jede `tools/*.test.mjs` nacheinander mit node aus (alphabetisch, erster Fehler bricht ab).
 * Mit `--alle` laufen alle durch, am Ende steht die Liste der roten Tests (Exit 1) — wie bei `check:logic --alle`.
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
const alle = process.argv.includes('--alle')
const rote = []

for (const test of tests) {
  console.log(`[tests-alle] tools/${test}`)
  const lauf = spawnSync(process.execPath, [join(tools, test)], { cwd: wurzel, stdio: 'inherit' })
  if (lauf.status === 0) continue
  rote.push(test)
  if (!alle) {
    console.error(`tests-alle: tools/${test} ist rot.`)
    console.error('Weitere Fehler dahinter bleiben verdeckt. Alle roten Tests auf einmal: `node tools/tests-alle.mjs --alle`.')
    process.exit(lauf.status ?? 1)
  }
}
if (rote.length > 0) {
  console.error(`tests-alle: ${rote.length} von ${tests.length} Tests rot:`)
  for (const test of rote) console.error(`  - tools/${test}`)
  process.exit(1)
}
console.log(`tests-alle: ${tests.length} von ${tests.length} Tests grün.`)
