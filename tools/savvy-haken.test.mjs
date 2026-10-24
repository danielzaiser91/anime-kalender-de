/**
 * Test für `tools/claude-global/savvy-haken.mjs`: Hook da, Hook fehlt, falscher Schlüssel, Hook ohne togglePane, leere Datei,
 * savvy nicht installiert; dazu Prozessläufe von `einrichten.mjs --pruefen` auf einem eingerichteten Wegwerf-Ziel
 * (Exit 1 nur bei fehlendem Hook, Zeile im Lauf).
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { pruefeSavvyHaken } from './claude-global/savvy-haken.mjs'

const GUT = "on('state.set', { plugin: 'arbeitsliste', key: 'agentenKnopf' } as never, async ($, e, next) => {\n  const r = await next(e)\n  await togglePane($)\n  return r\n})\n"
const FAELLE = [
  ['Hook da', GUT, false, /^ok/],
  ['Hook fehlt', "on('tool.call', {}, async () => {})\n", true, /^FEHLT/],
  ['falscher Schluessel', GUT.replace('agentenKnopf', 'anderer'), true, /^FEHLT/],
  ['ohne togglePane', GUT.replace('togglePane($)', 'nichts($)'), true, /^FEHLT/],
  ['leere Datei', '', true, /^FEHLT/],
]
const skript = join(import.meta.dirname, 'claude-global', 'einrichten.mjs')
const wurzel = mkdtempSync(join(tmpdir(), 'savvy-haken-'))
const fahre = (ziel, ...args) => spawnSync(process.execPath, [skript, ...args], { encoding: 'utf8', env: { ...process.env, CLAUDE_CONFIG_DIR: ziel } })

try {
  const leer = pruefeSavvyHaken(join(wurzel, 'leer'))
  assert.equal(leer.fehlt, false, 'savvy nicht installiert: nichts zu melden')
  assert.match(leer.zeile, /^übersprungen/)
  for (const [name, text, fehlt, muster] of FAELLE) {
    const ziel = join(wurzel, name.replace(/ /g, '_'))
    const hooks = join(ziel, 'mods', 'claude-kit', 'plugins', 'savvy-progress', 'hooks')
    mkdirSync(hooks, { recursive: true })
    writeFileSync(join(hooks, 'register.tsx'), text)
    const r = pruefeSavvyHaken(ziel)
    assert.equal(r.fehlt, fehlt, name)
    assert.match(r.zeile, muster, name)
    assert.equal(fahre(ziel).status, 0, `${name}: einrichten`)
    const lauf = fahre(ziel, '--pruefen')
    assert.match(lauf.stdout, fehlt ? /FEHLT Hook für den Agents-Knopf/ : /ok: savvy-progress hat den Hook/, `${name}: Zeile im Lauf`)
    assert.equal(lauf.status, fehlt ? 1 : 0, `${name}: --pruefen Exit`)
  }
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
console.log('savvy-haken.test: ok (Hook da, fehlt, falscher Schlüssel, ohne togglePane, leere Datei, nicht installiert, einrichten --pruefen)')
