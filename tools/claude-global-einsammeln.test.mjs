/**
 * Test für `tools/claude-global/einrichten.mjs`, Teile `agents/` und `--einsammeln`. Das Skript läuft als Kopie in einem Wegwerf-"Repo"
 * (es schreibt beim Einsammeln in sein eigenes Verzeichnis, das echte Repo bleibt unberührt) gegen ein Wegwerf-Ziel (CLAUDE_CONFIG_DIR).
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const echt = join(import.meta.dirname, 'claude-global')
const wurzel = mkdtempSync(join(tmpdir(), 'einsammeln-'))
const repo = join(wurzel, 'repo')
const ziel = join(wurzel, 'ziel')
const schreibe = (datei, text) => {
  mkdirSync(join(datei, '..'), { recursive: true })
  writeFileSync(datei, text)
}
const lies = (datei) => readFileSync(datei, 'utf8')
const fahre = (...args) =>
  spawnSync(process.execPath, [join(repo, 'einrichten.mjs'), ...args], { encoding: 'utf8', timeout: 60000, env: { ...process.env, CLAUDE_CONFIG_DIR: ziel } })
const alleDateien = (ordner) =>
  readdirSync(ordner, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? alleDateien(join(ordner, e.name)).map((d) => join(e.name, d)) : [e.name]))

try {
  mkdirSync(repo, { recursive: true })
  for (const datei of ['einrichten.mjs', 'savvy-haken.mjs']) copyFileSync(join(echt, datei), join(repo, datei))
  schreibe(join(repo, 'agents', 'bauer.md'), 'bauer neu\n')
  schreibe(join(repo, 'agents', 'archiv', 'alt.md'), 'archiv\n')
  schreibe(join(repo, 'rules', '10-regel.md'), 'regel repo\n')
  schreibe(join(repo, 'skills', 'meins', 'SKILL.md'), 'skill repo\n')
  schreibe(join(repo, 'hooks', 'h.js'), 'hook repo\n')
  schreibe(join(repo, 'mods', 'arbeitsliste', 'm.txt'), 'mod repo\n')

  const leer = fahre('--pruefen')
  assert.equal(leer.status, 1, '--pruefen ohne Agent am Ziel: Exit 1')
  assert.match(leer.stdout, /FEHLT .*bauer\.md/)
  assert.equal(existsSync(ziel), false, '--pruefen schreibt nichts')

  schreibe(join(ziel, 'agents', 'bauer.md'), 'bauer alt\n')
  const erster = fahre()
  assert.equal(erster.status, 0, erster.stderr)
  assert.equal(lies(join(ziel, 'agents', 'bauer.md')), 'bauer neu\n', 'Agent kommt am Ziel an')
  assert.equal(lies(join(ziel, 'agents', 'bauer.md.bak')), 'bauer alt\n', 'abweichender Agent als .bak gesichert')
  assert.equal(existsSync(join(ziel, 'agents', 'archiv')), false, 'archiv/ wird nicht kopiert')
  assert.equal(fahre('--pruefen').status, 0, '--pruefen danach: Exit 0')

  schreibe(join(ziel, 'agents', 'bauer.md'), 'bauer geschaerft\n')
  assert.equal(fahre('--pruefen').status, 1, 'veralteter Agent: Exit 1')

  // Einsammeln: eine Datei je Gruppe weicht ab, dazu fremde Dateien am Ziel, die nie ins Repo gehören.
  schreibe(join(ziel, 'rules', '10-regel.md'), 'regel ziel\n')
  schreibe(join(ziel, 'skills', 'meins', 'SKILL.md'), 'skill ziel\n')
  schreibe(join(ziel, 'hooks', 'h.js'), 'hook ziel\n')
  schreibe(join(ziel, 'mods', 'arbeitsliste', 'm.txt'), 'mod ziel\n')
  schreibe(join(ziel, 'agents', 'neu.md'), 'fremder Agent\n')
  schreibe(join(ziel, 'rules', '99-fremd.md'), 'fremde Regel\n')
  schreibe(join(ziel, 'skills', 'fremd', 'SKILL.md'), 'fremder Skill\n')
  const vorher = alleDateien(repo).sort()
  const sammeln = fahre('--einsammeln')
  assert.equal(sammeln.status, 0, sammeln.stderr)
  assert.equal(lies(join(repo, 'agents', 'bauer.md')), 'bauer geschaerft\n', 'Agent eingesammelt')
  assert.equal(lies(join(repo, 'rules', '10-regel.md')), 'regel ziel\n', 'Regel eingesammelt')
  assert.equal(lies(join(repo, 'skills', 'meins', 'SKILL.md')), 'skill ziel\n', 'Skill eingesammelt')
  assert.equal(lies(join(repo, 'hooks', 'h.js')), 'hook ziel\n', 'Hook eingesammelt')
  assert.equal(lies(join(repo, 'mods', 'arbeitsliste', 'm.txt')), 'mod ziel\n', 'Mod-Datei eingesammelt')
  assert.deepEqual(alleDateien(repo).sort(), vorher, 'Einsammeln legt keine neuen Dateien an')
  assert.equal(lies(join(repo, 'agents', 'archiv', 'alt.md')), 'archiv\n', 'archiv/ bleibt')
  assert.equal(lies(join(ziel, 'agents', 'bauer.md')), 'bauer geschaerft\n', 'Ziel bleibt beim Einsammeln unberührt')

  // Fehlt eine verwaltete Datei am Ziel, bleibt die Repo-Fassung stehen (nichts wird gelöscht).
  rmSync(join(ziel, 'hooks', 'h.js'))
  assert.equal(fahre('--einsammeln').status, 0)
  assert.equal(lies(join(repo, 'hooks', 'h.js')), 'hook ziel\n', 'fehlende Zieldatei löscht nichts im Repo')
  assert.equal(fahre('--einsammeln').stdout.includes('geholt'), false, 'zweiter Lauf: nichts mehr zu holen')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

console.log('claude-global-einsammeln.test: ok (agents/ ohne archiv, .bak, --pruefen, --einsammeln je Gruppe, keine neuen Dateien, nichts gelöscht)')
