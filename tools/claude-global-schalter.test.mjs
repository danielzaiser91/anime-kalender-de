/**
 * Test für die Schalterprüfung von `tools/claude-global/einrichten.mjs`: Das Skript läuft als Prozess mit CLAUDE_CONFIG_DIR
 * auf einem Wegwerf-Ordner. --help/-h und unbekannte Schalter schreiben nichts; bekannte Schalter laufen wie bisher.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const skript = join(import.meta.dirname, 'claude-global', 'einrichten.mjs')
const ziel = mkdtempSync(join(tmpdir(), 'schalter-'))
const fahre = (...args) => spawnSync(process.execPath, [skript, ...args], { encoding: 'utf8', timeout: 60000, env: { ...process.env, CLAUDE_CONFIG_DIR: ziel } })
const leer = () => readdirSync(ziel).length === 0

try {
  for (const schalter of ['--help', '-h']) {
    const l = fahre(schalter)
    assert.equal(l.status, 0, `${schalter}: Exit 0`)
    assert.match(l.stdout, /--pruefen[\s\S]*--einsammeln/, `${schalter}: nennt die Schalter`)
    assert.ok(leer(), `${schalter} schreibt nichts`)
  }
  for (const args of [['--hilfe'], ['--pruefe'], ['-x'], ['--pruefen', '--tippfehler'], ['pruefen'], ['--neue-skills']]) {
    const l = fahre(...args)
    assert.equal(l.status, 2, `${args.join(' ')}: Exit 2`)
    assert.match(l.stderr, /Nichts geschrieben/)
    assert.match(l.stderr, /--einsammeln/, 'Meldung nennt die erlaubten Schalter')
    assert.ok(leer(), `${args.join(' ')} schreibt nichts`)
  }

  const p = fahre('--pruefen')
  assert.equal(p.status, 1, '--pruefen auf leerem Ziel: Exit 1 wie vorher')
  assert.match(p.stdout, /FEHLT /)
  assert.ok(leer(), '--pruefen schreibt nichts')

  const e = fahre('--einsammeln')
  assert.equal(e.status, 0, '--einsammeln läuft')
  assert.match(e.stdout, /fehlt /)
  assert.ok(leer(), '--einsammeln auf leerem Ziel schreibt nichts ins Ziel')
  assert.equal(fahre('--einsammeln', '--neue-skills').status, 0, '--einsammeln --neue-skills läuft')

  const r = fahre()
  assert.equal(r.status, 0, 'ohne Schalter: einrichten')
  assert.ok(existsSync(join(ziel, 'rules')) && existsSync(join(ziel, 'hooks')), 'ohne Schalter wird eingerichtet')
} finally {
  rmSync(ziel, { recursive: true, force: true })
}

console.log('claude-global-schalter.test: ok (--help/-h und 6 falsche Aufrufe schreiben nichts, --pruefen/--einsammeln/--neue-skills/ohne Schalter wie vorher)')
