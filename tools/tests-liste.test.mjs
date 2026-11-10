/** Test für `tools/tests-liste.mjs`: tests-alle fährt auch die Hook-Tests unter `.claude/hooks/` (Lücke aus PR 3310). */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findeTests } from './tests-liste.mjs'

const wurzel = mkdtempSync(join(tmpdir(), 'tests-liste-'))
try {
  const tools = join(wurzel, 'tools')
  const hooks = join(wurzel, '.claude', 'hooks')
  mkdirSync(tools, { recursive: true })
  mkdirSync(hooks, { recursive: true })
  for (const f of ['b.test.mjs', 'a.test.mjs', 'hilfe.mjs']) writeFileSync(join(tools, f), '')
  for (const f of ['guard-test.mjs', 'guard.js', 'x-test.mjs']) writeFileSync(join(hooks, f), '')
  assert.deepEqual(findeTests(tools, wurzel), ['../.claude/hooks/guard-test.mjs', '../.claude/hooks/x-test.mjs', 'a.test.mjs', 'b.test.mjs'])
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
console.log('tests-liste.test: ok (tools-Tests und Hook-Tests, Hilfsdateien ausgeschlossen)')
