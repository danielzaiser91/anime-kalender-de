/**
 * Test für `.claude/hooks/dispatch-pretooluse.js`: jedes Sperr-Modul im Repo (exportiert `pruefe`) hängt im
 * Dispatcher; fehlende lokale Module werden übersprungen; als Prozess gibt ein deny die Hook-Ausgabe.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const hooks = join(import.meta.dirname, '..', '.claude', 'hooks')
const require = createRequire(import.meta.url)
const { MODULE } = require(join(hooks, 'dispatch-pretooluse.js'))
const eingehaengt = new Set(MODULE.map(([name]) => name))

// pruefrunden.js und agenten-grenze.js haben den Matcher Agent, agenten-vorrat.js ist ein Stop-Hook; alle drei mit eigenem Eintrag in settings.json, kein Teil des Bündels.
const EIGENER_EINTRAG = new Set(['pruefrunden.js', 'agenten-grenze.js', 'agenten-vorrat.js'])
const sperren = readdirSync(hooks).filter((d) => d.endsWith('.js') && !EIGENER_EINTRAG.has(d) && typeof require(join(hooks, d)).pruefe === 'function')
assert.ok(sperren.length >= 3, `Sperr-Module gefunden: ${sperren.join(', ')}`)
for (const name of sperren) assert.ok(eingehaengt.has(name), `${name} exportiert pruefe, steht aber nicht im Dispatcher (MODULE)`)

const wurzel = mkdtempSync(join(tmpdir(), 'dispatch-test-'))
try {
  const kopie = join(wurzel, 'hooks')
  mkdirSync(kopie)
  for (const d of readdirSync(hooks)) copyFileSync(join(hooks, d), join(kopie, d))
  rmSync(join(kopie, 'guard.js'))
  const lauf = (input) => spawnSync(process.execPath, [join(kopie, 'dispatch-pretooluse.js')], { input: JSON.stringify(input), encoding: 'utf8', timeout: 30000, windowsHide: true })

  const harmlos = lauf({ tool_name: 'Bash', tool_input: { command: 'echo hallo' } })
  assert.equal(harmlos.status, 0)
  assert.equal(harmlos.stdout, '', 'harmlose Eingabe: keine Entscheidung')
  assert.match(harmlos.stderr, /guard\.js fehlt, übersprungen/, 'fehlendes lokales Modul: Zeile auf stderr')
  assert.doesNotMatch(harmlos.stderr, /no-verify-sperre\.js fehlt/, 'vorhandenes Modul wird nicht als fehlend gemeldet')

  const verboten = lauf({ tool_name: 'Bash', tool_input: { command: 'git commit --no-verify -m x' } })
  assert.equal(verboten.status, 0)
  const aus = JSON.parse(verboten.stdout).hookSpecificOutput
  assert.equal(aus.hookEventName, 'PreToolUse')
  assert.equal(aus.permissionDecision, 'deny')
  assert.match(aus.permissionDecisionReason, /--no-verify/)

  const kaputt = spawnSync(process.execPath, [join(kopie, 'dispatch-pretooluse.js')], { input: 'kein json', encoding: 'utf8', timeout: 30000, windowsHide: true })
  assert.equal(kaputt.status, 0, 'kaputte Eingabe: Exit 0, nie umfallen')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
console.log(`dispatch-pretooluse ok: ${sperren.length} Sperr-Module im Dispatcher, fehlendes Modul übersprungen, deny als Prozess`)
