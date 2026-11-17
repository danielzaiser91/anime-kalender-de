// Test für mod-leiste-pruefen.js: node .claude/hooks/mod-leiste-pruefen-test.mjs
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, lstatSync, writeFileSync, statSync, utimesSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const { pruefen, MELDUNG } = createRequire(import.meta.url)('./mod-leiste-pruefen.js')
const wurzel = mkdtempSync(join(tmpdir(), 'mod-leiste-'))
const projekt = join(wurzel, 'projekt')
const manifest = join(projekt, '.claude', 'mods', 'arbeitsliste', '.claude-plugin', 'plugin.json')
mkdirSync(join(manifest, '..'), { recursive: true })
writeFileSync(manifest, '{}')
const alt = new Date(2020, 0, 1)
utimesSync(manifest, alt, alt)
const basis = join(wurzel, 'dev-mods')
const env = { CLAUDE_PROJECT_DIR: projekt, MOD_LEISTE_DEVMODS: basis, CLAUDE_CODE_PLUGIN_DIRS: '' }
const eingabe = JSON.stringify({ session_id: 'abc' })

try {
  assert.equal(pruefen(eingabe, { ...env, CLAUDE_CODE_PLUGIN_DIRS: 'x' }), '', 'gesetzt: still')
  assert.throws(() => lstatSync(join(basis, 'abc')), 'gesetzt: keine Junction')

  assert.equal(pruefen(eingabe, env), MELDUNG, 'leer: Meldung')
  assert.ok(lstatSync(join(basis, 'abc', 'arbeitsliste')).isSymbolicLink(), 'Junction gesetzt')
  assert.ok(statSync(manifest).mtimeMs > alt.getTime() + 1000, 'plugin.json berührt')

  assert.equal(pruefen(eingabe, env), MELDUNG, 'zweiter Lauf: Junction vorhanden, trotzdem Meldung')
  assert.equal(pruefen('kaputt', env), '', 'kaputte Eingabe: still')
  assert.equal(pruefen('{}', env), '', 'ohne session_id: still')
  assert.equal(pruefen(JSON.stringify({ session_id: '../x' }), env), '', 'Pfadtrick: still')
  assert.equal(pruefen(eingabe, { ...env, CLAUDE_PROJECT_DIR: join(wurzel, 'leer') }), '', 'Mod fehlt: still')
  console.log('mod-leiste-pruefen-test: 8 Fälle grün')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
