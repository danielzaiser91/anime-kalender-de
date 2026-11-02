/**
 * Test für `tools/claude-global/einrichten.mjs`, Teile `agents/` und `--einsammeln`. Das Skript läuft als Kopie in einem Wegwerf-"Repo"
 * (es schreibt beim Einsammeln in sein eigenes Verzeichnis, das echte Repo bleibt unberührt) gegen ein Wegwerf-Ziel (CLAUDE_CONFIG_DIR).
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
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

/**
 * Schutz vor dem Überschreiben einer neueren Repo-Fassung, gegen echtes git in einem Wegwerf-Repo mit festen Commit-Zeiten.
 * Ziel-Dateien tragen 2030 als Änderungszeit; Repo-Stand: Commit 2000 (älter, wird geholt) bzw. 2099 (neuer, bleibt),
 * ungesicherte Änderung zählt mit ihrer Dateizeit.
 */
function pruefeSchutzNeuerRepoFassung() {
  const r = join(wurzel, 'repo2')
  const z = join(wurzel, 'ziel2')
  const lauf = () => spawnSync(process.execPath, [join(r, 'einrichten.mjs'), '--einsammeln'], { encoding: 'utf8', timeout: 60000, env: { ...process.env, CLAUDE_CONFIG_DIR: z } })
  const git = (datum, ...args) =>
    spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-C', r, ...args], { encoding: 'utf8', timeout: 30000, windowsHide: true, env: { ...process.env, GIT_AUTHOR_DATE: datum, GIT_COMMITTER_DATE: datum } })
  const setzeZeit = (datei, iso) => utimesSync(datei, new Date(iso), new Date(iso))
  mkdirSync(r, { recursive: true })
  for (const datei of ['einrichten.mjs', 'savvy-haken.mjs']) copyFileSync(join(echt, datei), join(r, datei))
  schreibe(join(r, 'skills-ausschluss.json'), '{}')
  for (const datei of ['rules/alt.md', 'skills/s/SKILL.md', 'hooks/h.js', 'mods/arbeitsliste/m.txt']) schreibe(join(r, datei), 'repo\n')
  assert.equal(git('2000-01-01T00:00:00Z', 'init', '-q').status, 0)
  assert.equal(git('2000-01-01T00:00:00Z', 'add', '-A').status, 0)
  assert.equal(git('2000-01-01T00:00:00Z', 'commit', '-q', '-m', 'alt').status, 0)
  schreibe(join(r, 'agents', 'neu.md'), 'repo\n')
  assert.equal(git('2099-01-01T00:00:00Z', 'add', '-A').status, 0)
  assert.equal(git('2099-01-01T00:00:00Z', 'commit', '-q', '-m', 'neu').status, 0)
  schreibe(join(r, 'skills', 's', 'SKILL.md'), 'repo ungesichert neu\n')
  schreibe(join(r, 'hooks', 'h.js'), 'repo ungesichert alt\n')
  setzeZeit(join(r, 'skills', 's', 'SKILL.md'), '2099-01-01T00:00:00Z')
  setzeZeit(join(r, 'hooks', 'h.js'), '2001-01-01T00:00:00Z')
  for (const datei of ['agents/neu.md', 'rules/alt.md', 'skills/s/SKILL.md', 'hooks/h.js', 'mods/arbeitsliste/m.txt']) {
    schreibe(join(z, datei), 'ziel\n')
    setzeZeit(join(z, datei), '2030-01-01T00:00:00Z')
  }
  const aus = lauf()
  assert.equal(aus.status, 0, aus.stderr)
  assert.match(aus.stdout, /UEBERSPRUNGEN .*neu\.md/, 'Commit neuer als Ziel: übersprungen gemeldet')
  assert.equal(lies(join(r, 'agents', 'neu.md')), 'repo\n', 'Commit neuer als Ziel: Repo-Fassung bleibt')
  assert.equal(lies(join(r, 'rules', 'alt.md')), 'ziel\n', 'Commit älter als Ziel: geholt')
  assert.equal(lies(join(r, 'skills', 's', 'SKILL.md')), 'repo ungesichert neu\n', 'ungesicherte Änderung neuer als Ziel: bleibt')
  assert.equal(lies(join(r, 'hooks', 'h.js')), 'ziel\n', 'ungesicherte Änderung älter als Ziel: geholt')
  assert.equal(lies(join(r, 'mods', 'arbeitsliste', 'm.txt')), 'ziel\n', 'Commit älter als Ziel: geholt')
  assert.equal(lies(join(z, 'agents', 'neu.md')), 'ziel\n', 'Ziel bleibt unberührt')
}

try {
  mkdirSync(repo, { recursive: true })
  for (const datei of ['einrichten.mjs', 'savvy-haken.mjs']) copyFileSync(join(echt, datei), join(repo, datei))
  schreibe(join(repo, 'skills-ausschluss.json'), JSON.stringify({ privat: 'Test', fehltamziel: 'Test' }))
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
  // --neue-skills: neue Skills samt Unterordner kommen ins Repo; ausgeschlossene, .bak und Punkt-Ordner nie.
  schreibe(join(ziel, 'skills', 'fremd', 'refs', 'a.md'), 'unter\n')
  schreibe(join(ziel, 'skills', 'fremd', 'SKILL.md.bak-x'), 'sicherung\n')
  schreibe(join(ziel, 'skills', 'privat', 'SKILL.md'), 'privat\n')
  schreibe(join(ziel, 'skills', '.trash', 'alt', 'SKILL.md'), 'papierkorb\n')
  schreibe(join(ziel, 'skills', 'meins', 'extra.md'), 'extra\n')
  schreibe(join(ziel, 'skills', 'fremd', '.env'), 'GEHEIM=1\n')
  schreibe(join(ziel, 'skills', 'fremd', '.cache', 'z.txt'), 'cache\n')
  schreibe(join(ziel, 'skills', 'constructor', 'SKILL.md'), 'Name wie ein Object-Prototyp\n')
  assert.equal(fahre('--einsammeln').status, 0)
  assert.equal(existsSync(join(repo, 'skills', 'fremd')), false, 'ohne --neue-skills kein neuer Skill')
  assert.equal(existsSync(join(repo, 'skills', 'meins', 'extra.md')), false, 'ohne --neue-skills keine neue Datei')
  const neu = fahre('--einsammeln', '--neue-skills')
  assert.equal(neu.status, 0, neu.stderr)
  assert.equal(lies(join(repo, 'skills', 'fremd', 'SKILL.md')), 'fremder Skill\n', 'neuer Skill eingesammelt')
  assert.equal(lies(join(repo, 'skills', 'fremd', 'refs', 'a.md')), 'unter\n', 'Unterordner eingesammelt')
  assert.equal(lies(join(repo, 'skills', 'meins', 'extra.md')), 'extra\n', 'neue Datei eines verwalteten Skills')
  assert.equal(existsSync(join(repo, 'skills', 'fremd', 'SKILL.md.bak-x')), false, '.bak nie')
  assert.equal(existsSync(join(repo, 'skills', 'privat')), false, 'ausgeschlossener Skill nie')
  assert.equal(existsSync(join(repo, 'skills', '.trash')), false, 'Punkt-Ordner nie')
  assert.equal(existsSync(join(repo, 'skills', 'fremd', '.env')), false, 'Punkt-Datei in einem Skill nie')
  assert.equal(existsSync(join(repo, 'skills', 'fremd', '.cache')), false, 'verschachtelter Punkt-Ordner nie')
  assert.equal(lies(join(repo, 'skills', 'constructor', 'SKILL.md')), 'Name wie ein Object-Prototyp\n', 'Ausschluss gilt nur für eigene Schlüssel der Liste')
  assert.equal(fahre('--pruefen').stdout.includes('privat'), false, '--pruefen nennt ausgeschlossene Skills nicht')
  assert.equal(fahre('--einsammeln', '--neue-skills').stdout.includes('geholt'), false, 'zweiter Lauf: nichts mehr zu holen')

  // --neue-skills ohne --einsammeln wirkt nicht: ein Skill nur am Ziel taucht weder in der Ausgabe noch im Repo auf.
  schreibe(join(ziel, 'skills', 'nurziel', 'SKILL.md'), 'nur am Ziel\n')
  const allein = fahre('--pruefen', '--neue-skills')
  assert.equal(allein.stdout.includes('nurziel'), false, '--neue-skills allein: Skill nur am Ziel bleibt unbeachtet')
  assert.equal(existsSync(join(repo, 'skills', 'nurziel')), false, '--neue-skills allein legt im Repo nichts an')
  assert.equal(lies(join(ziel, 'skills', 'nurziel', 'SKILL.md')), 'nur am Ziel\n', 'Ziel bleibt unberührt')

  pruefeSchutzNeuerRepoFassung()
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

console.log('claude-global-einsammeln.test: ok (agents/ ohne archiv, .bak, --pruefen, --einsammeln je Gruppe, keine neuen Dateien, nichts gelöscht, --neue-skills mit Ausschluss, Punkt-Dateien, Schutz neuerer Repo-Fassung)')
