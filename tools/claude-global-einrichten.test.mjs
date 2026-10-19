/**
 * Test für `tools/claude-global/einrichten.mjs`, Teil `hooks/`: fährt das Skript als Prozess mit CLAUDE_CONFIG_DIR auf einem
 * Wegwerf-Ordner. Der Hook kommt byte-gleich an, `hooks/package.json` (nur fürs Repo) nicht, fremde Dateien am Ziel bleiben,
 * eine abweichende Fassung wird als .bak gesichert, und --pruefen schreibt nichts und meldet Abweichung mit Exit 1.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const skript = join(import.meta.dirname, 'claude-global', 'einrichten.mjs')
const quelle = readFileSync(join(import.meta.dirname, 'claude-global', 'hooks', 'pruefrunden.js'), 'utf8')
const ziel = mkdtempSync(join(tmpdir(), 'einrichten-'))
const hooks = join(ziel, 'hooks')
const fahre = (...args) => spawnSync(process.execPath, [skript, ...args], { encoding: 'utf8', env: { ...process.env, CLAUDE_CONFIG_DIR: ziel } })

try {
  const leer = fahre('--pruefen')
  assert.equal(leer.status, 1, '--pruefen ohne Hook am Ziel: Exit 1')
  assert.match(leer.stdout, /FEHLT .*pruefrunden\.js/)
  assert.equal(existsSync(hooks), false, '--pruefen schreibt nichts')

  mkdirSync(hooks, { recursive: true })
  writeFileSync(join(hooks, 'fremd.js'), 'fremder Hook\n')
  writeFileSync(join(hooks, 'package.json'), '{"fremd":true}\n')
  writeFileSync(join(hooks, 'pruefrunden.js'), 'alte Fassung\n')
  const erster = fahre()
  assert.equal(erster.status, 0)
  assert.equal(readFileSync(join(hooks, 'pruefrunden.js'), 'utf8'), quelle, 'Hook byte-gleich')
  assert.equal(readFileSync(join(hooks, 'pruefrunden.js.bak'), 'utf8'), 'alte Fassung\n', 'abweichende Fassung als .bak gesichert')
  assert.equal(readFileSync(join(hooks, 'package.json'), 'utf8'), '{"fremd":true}\n', 'fremde package.json bleibt, die des Repos wird nicht kopiert')
  assert.equal(readFileSync(join(hooks, 'fremd.js'), 'utf8'), 'fremder Hook\n', 'fremder Hook bleibt')
  assert.equal(existsSync(join(hooks, 'fremd.js.bak')), false)

  assert.equal(fahre('--pruefen').status, 0, '--pruefen danach: Exit 0')

  rmSync(join(hooks, 'package.json'))
  fahre()
  assert.equal(existsSync(join(hooks, 'package.json')), false, 'hooks/package.json wird nie angelegt')
} finally {
  rmSync(ziel, { recursive: true, force: true })
}

console.log('claude-global-einrichten.test: ok (hooks/ byte-gleich, .bak, fremde Dateien, package.json nicht, --pruefen)')
