// Test zu tools/mod-tests.mjs: Pfadfilter und Befehlswahl als feste Fälle; der Prozess-Fall läuft ohne Netz (nur der Filterzweig).
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { betrifftMods, testBefehl } from './mod-tests.mjs'

assert.equal(betrifftMods(['tools/claude-global/mods/arbeitsliste/hooks/ziele.ts']), true)
assert.equal(betrifftMods(['tools/claude-global/mods/arbeitsliste/types/index.d.ts']), true)
assert.equal(betrifftMods(['tools/claude-global/rules/10.md', 'tools/claude-global/skills/x/SKILL.md']), false)
assert.equal(betrifftMods(['xtools/claude-global/mods/a']), false)
assert.equal(betrifftMods([]), false)

const a = testBefehl(true, '/m')
assert.deepEqual([a.cmd, a.args], ['claude', ['plugin', 'test', '/m']])
const b = testBefehl(false, '/m')
assert.equal(b.cmd, 'npx')
assert.deepEqual(b.args.slice(-3), ['plugin', 'test', '/m'])
assert.match(b.args[1], /^@anthropic-ai\/claude-code@\d+\.\d+\.\d+$/)

// Prozess: Merge-Commit ohne Änderung unter mods/ → übersprungen, Exit 0, Schlusszeile.
const wurzel = mkdtempSync(join(tmpdir(), 'modtests-'))
const g = (...args) => {
  const r = spawnSync('git', args, { cwd: wurzel, encoding: 'utf8', windowsHide: true, timeout: 30000 })
  assert.equal(r.status, 0, r.stderr)
  return r.stdout
}
g('init', '-q', '-b', 'main')
g('config', 'user.email', 'a@b.c')
g('config', 'user.name', 'T')
writeFileSync(join(wurzel, 'a.txt'), '1')
g('add', 'a.txt')
g('commit', '-q', '-m', 'a')
g('checkout', '-q', '-b', 'pr')
mkdirSync(join(wurzel, 'x'))
writeFileSync(join(wurzel, 'x', 'b.txt'), '1')
g('add', 'x/b.txt')
g('commit', '-q', '-m', 'b')
g('checkout', '-q', 'main')
writeFileSync(join(wurzel, 'c.txt'), '1')
g('add', 'c.txt')
g('commit', '-q', '-m', 'c')
g('merge', '-q', '--no-ff', '-m', 'merge', 'pr')
const skript = join(import.meta.dirname, 'mod-tests.mjs')
const lauf = spawnSync(process.execPath, [skript], { cwd: wurzel, encoding: 'utf8', windowsHide: true, timeout: 60000, env: { ...process.env, GITHUB_EVENT_NAME: 'pull_request' } })
assert.equal(lauf.status, 0, lauf.stderr)
assert.match(lauf.stdout, /mod-tests: übersprungen \(PR ändert nichts unter tools\/claude-global\/mods\/, 1 Dateien\)/)
console.log('✔ mod-tests.test: 5 Filterfälle, Befehlswahl, Prozessfall übersprungen')
