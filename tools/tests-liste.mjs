/** Die Tests, die `tools/tests-alle.mjs` fährt: `tools/*.test.mjs` plus `.claude/hooks/*-test.mjs` (Pfad relativ zu `tools/`), sortiert. */
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

export function findeTests(tools, wurzel) {
  const hookTests = readdirSync(join(wurzel, '.claude', 'hooks')).filter((f) => f.endsWith('-test.mjs')).map((f) => `../.claude/hooks/${f}`)
  return [...readdirSync(tools).filter((f) => f.endsWith('.test.mjs')), ...hookTests].sort()
}
