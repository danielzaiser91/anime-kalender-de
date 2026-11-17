/**
 * Test für `.claude/hooks/dispatch-pretooluse.js`: jedes Sperr-Modul im Repo (exportiert `pruefe`) hängt im
 * Dispatcher; fehlende lokale Module werden übersprungen; als Prozess gibt ein deny die Hook-Ausgabe.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const hooks = join(import.meta.dirname, '..', '.claude', 'hooks')
const require = createRequire(import.meta.url)
const { MODULE } = require(join(hooks, 'dispatch-pretooluse.js'))
const eingehaengt = new Set(MODULE.map(([name]) => name))
const { entscheide } = require(join(hooks, 'dispatch-pretooluse.js'))

// Verdrahtung wrap_up: der Dispatcher ruft wrapup-sperre.js (Art 'grund') auf diesem Ereignis wirklich auf.
const wrap = (tool_input) => entscheide({ tool_name: 'mcp__ccd_turn__wrap_up', tool_input })
const mitFrage = wrap({ recap: 'x', ask: '?' })
assert.equal(mitFrage?.permissionDecision, 'deny', 'wrap_up mit ask: deny')
assert.match(mitFrage.permissionDecisionReason, /^wrap_up nur mit recap/, 'Grund aus wrapup-sperre.js')
assert.equal(wrap({ recap: 'x' }), null, 'wrap_up nur recap: keine Entscheidung (andere Module werfen nicht)')
assert.ok(MODULE.some(([n, a]) => n === 'wrapup-sperre.js' && a === 'grund'), 'wrapup-sperre.js als Art grund eingetragen')

// Matcher: der Eintrag in settings.json, der den Dispatcher ruft, muss wrap_up nennen (sonst läuft die Sperre nie).
export function matcherNenntWrapUp(settings) {
  const eintraege = (settings.hooks?.PreToolUse ?? []).filter((e) => (e.hooks ?? []).some((h) => String(h.command).includes('dispatch-pretooluse')))
  return eintraege.length > 0 && eintraege.every((e) => String(e.matcher).split('|').includes('mcp__ccd_turn__wrap_up'))
}
const settings = JSON.parse(readFileSync(join(hooks, '..', 'settings.json'), 'utf8'))
assert.ok(matcherNenntWrapUp(settings), 'settings.json: Matcher des Dispatchers nennt mcp__ccd_turn__wrap_up')
const eintragD = { matcher: 'Edit|Write|Bash', hooks: [{ command: 'node dispatch-pretooluse.js' }] }
assert.equal(matcherNenntWrapUp({ hooks: { PreToolUse: [eintragD] } }), false, 'Matcher ohne wrap_up: rot')
assert.equal(matcherNenntWrapUp({ hooks: { PreToolUse: [{ ...eintragD, matcher: 'Bash|mcp__ccd_turn__wrap_up_x' }] } }), false, 'Teilname zählt nicht')
assert.equal(matcherNenntWrapUp({ hooks: { PreToolUse: [{ ...eintragD, matcher: 'Bash|mcp__ccd_turn__wrap_up' }] } }), true, 'Matcher mit wrap_up: grün')
assert.equal(matcherNenntWrapUp({ hooks: { PreToolUse: [] } }), false, 'kein Dispatcher-Eintrag: rot')

// pruefrunden.js und agenten-grenze.js haben den Matcher Agent, agenten-vorrat.js ist ein Stop-Hook; alle drei mit eigenem Eintrag in settings.json, kein Teil des Bündels.
// falls-vorhanden.js ist ein Startskript (process.exit beim Laden): ein require beendete den Test bisher still mit Exit 0, vor allen Zusicherungen.
const EIGENER_EINTRAG = new Set(['pruefrunden.js', 'agenten-grenze.js', 'agenten-vorrat.js', 'falls-vorhanden.js', 'cd-unterordner-sperre.js'])
// cd-unterordner-sperre.js ist über hauptordner-sperre.js eingebunden (Kopfkommentar dort), kein eigener Eintrag im Bündel.
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
