/**
 * `npm run check:logic`: führt die Prüfungen aus tools/check-logic-liste.txt nacheinander mit tsx aus.
 * Eine Datei je Zeile (Pfad ab Repo-Wurzel), `#` beginnt einen Kommentar. Der erste Fehler bricht ab
 * und gibt dessen Exit-Code zurück. Eigene Datei statt einer Kette in package.json, damit zwei PRs,
 * die je einen Check ergänzen, nicht in derselben Zeile kollidieren; die Liste ist sortiert, damit sie auch
 * nicht an derselben Stelle (Listenende) einfügen.
 */
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const tools = dirname(fileURLToPath(import.meta.url))
const wurzel = join(tools, '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')

const dateien = readFileSync(join(tools, 'check-logic-liste.txt'), 'utf8')
  .split(/\r?\n/)
  .map((z) => z.trim())
  .filter((z) => z && !z.startsWith('#'))

if (dateien.length === 0) {
  console.error('check:logic: tools/check-logic-liste.txt enthält keine Prüfung.')
  process.exit(1)
}

const unsortiert = dateien.find((d, i) => i > 0 && d < dateien[i - 1])
if (unsortiert) {
  console.error(`check:logic: tools/check-logic-liste.txt muss alphabetisch sortiert sein (${unsortiert} steht zu früh).`)
  process.exit(1)
}

for (const [i, datei] of dateien.entries()) {
  console.log(`[check:logic ${i + 1}/${dateien.length}] ${datei}`)
  const lauf = spawnSync(process.execPath, [tsx, datei], { cwd: wurzel, stdio: 'inherit' })
  if (lauf.status !== 0) {
    console.error(`check:logic: ${datei} ist rot (nach ${i} grünen von ${dateien.length}).`)
    process.exit(lauf.status ?? 1)
  }
}
console.log(`check:logic: ${dateien.length} von ${dateien.length} Prüfungen grün.`)
