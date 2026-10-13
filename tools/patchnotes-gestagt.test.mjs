/**
 * Test für `tools/patchnotes-gestagt-pruefen.mjs` (Pre-commit): kaputtes YAML und Schemafehler gestagter Patch-Notes-Dateien
 * halten den Commit an, ohne gestagte Einträge läuft nichts, und `quellen-commit-wache.sh --einrichten` hängt die Prüfung in den Hook
 * (auch aus einem Worktree, dessen `.git` eine Datei ist).
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pruefeGestagte } from './patchnotes-gestagt-pruefen.mjs'

const tools = import.meta.dirname
const werkzeug = path.join(tools, 'patchnotes-gestagt-pruefen.mjs')
const GUT = 'kategorie: feature\ntext: Neuer Knopf im Kalender\n'
// Der Doppelpunkt im Untertitel bricht das YAML (Anlass 12.10.2026).
const DOPPELPUNKT = 'kategorie: feature\ntext: Neuer Knopf\nuntertitel: Version 4: neu\n'

const meldungen = await pruefeGestagte([{ name: 'a', text: DOPPELPUNKT }], [])
assert.equal(meldungen.length, 1, `Doppelpunkt im Untertitel: ${meldungen}`)
assert.match(meldungen[0], /^a: kein gültiges YAML/)
assert.match(meldungen[0], /Anführungszeichen/, 'Hinweis auf die Ursache')

const lang = await pruefeGestagte([{ name: 'b', text: 'kategorie: feature\ntext: eins zwei drei vier fünf sechs sieben acht neun\n' }], [])
assert.ok(lang.some((m) => m.startsWith('b:') && m.includes('9 Wörter')), `Schema: ${lang}`)
assert.deepEqual(await pruefeGestagte([{ name: 'c', text: GUT }], []), [], 'gültige Datei')

const dublette = await pruefeGestagte([{ name: 'd', text: GUT }], [{ name: 'alt', text: GUT }])
assert.ok(dublette.some((m) => m.includes('doppelt')), `Dublette gegen vorhandene Einträge: ${dublette}`)
assert.deepEqual(await pruefeGestagte([{ name: 'e', text: GUT }], [{ name: 'kaputt', text: DOPPELPUNKT }]), [], 'kaputte fremde Datei zählt nicht')

const wurzel = mkdtempSync(path.join(tmpdir(), 'patchnotes-gestagt-'))
const repo = path.join(wurzel, 'repo')
const roh = (ort, ...args) => execFileSync('git', ['-C', ort, '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.autocrlf=false', ...args], { encoding: 'utf8' })
const git = (...args) => roh(repo, ...args)
const eintrag = (n, text) => writeFileSync(path.join(repo, 'data/patchnotes', `${n}.yaml`), text)
const lauf = () => {
  const start = Date.now()
  const r = spawnSync(process.execPath, [werkzeug], { cwd: repo, encoding: 'utf8' })
  return { ...r, dauer: Date.now() - start }
}

try {
  mkdirSync(path.join(repo, 'data/patchnotes'), { recursive: true })
  git('init', '-q', '-b', 'main')
  eintrag('vorhanden', 'kategorie: bugfix\ntext: Alter Eintrag\n')
  writeFileSync(path.join(repo, 'andere.txt'), 'x\n')
  git('add', '-A')
  git('commit', '-q', '-m', 'start')

  writeFileSync(path.join(repo, 'andere.txt'), 'y\n')
  git('add', '-A')
  assert.equal(lauf().status, 0, 'ohne gestagte Patch Notes läuft nichts')

  eintrag('kaputt', DOPPELPUNKT)
  git('add', '-A')
  const rot = lauf()
  assert.equal(rot.status, 1, 'gestagtes kaputtes YAML hält den Commit an')
  assert.match(rot.stderr, /kaputt: kein gültiges YAML/)

  eintrag('kaputt', GUT) // nur im Arbeitsverzeichnis korrigiert: der Index entscheidet
  assert.equal(lauf().status, 1, 'geprüft wird der Index, nicht das Arbeitsverzeichnis')
  git('add', '-A')
  const gruen = lauf()
  assert.equal(gruen.status, 0, `korrigiert und gestagt: ${gruen.stderr}`)
  assert.ok(gruen.dauer < 2000, `Pre-commit-Prüfung dauert ${gruen.dauer} ms (Grenze 2000)`)

  git('commit', '-q', '-m', 'ok')
  git('rm', '-q', 'data/patchnotes/kaputt.yaml')
  assert.equal(lauf().status, 0, 'gelöschter Eintrag wird nicht geprüft')

  // --einrichten aus einem Worktree: schreibt in das gemeinsame hooks-Verzeichnis und nennt die Prüfung.
  mkdirSync(path.join(repo, 'tools'))
  copyFileSync(path.join(tools, 'quellen-commit-wache.sh'), path.join(repo, 'tools/quellen-commit-wache.sh'))
  git('add', '-A')
  git('commit', '-q', '-m', 'wache')
  const baum = path.join(wurzel, 'baum')
  git('worktree', 'add', '--quiet', '--detach', baum, 'HEAD')
  const einrichten = spawnSync('bash', ['tools/quellen-commit-wache.sh', '--einrichten'], { cwd: baum, encoding: 'utf8' })
  assert.equal(einrichten.status, 0, `--einrichten im Worktree: ${einrichten.stderr}`)
  const hook = readFileSync(path.join(repo, '.git/hooks/pre-commit'), 'utf8')
  assert.match(hook, /umfang-pruefen\.mjs/, 'bisherige Prüfung bleibt')
  assert.match(hook, /patchnotes-gestagt-pruefen\.mjs/, 'Patch-Notes-Prüfung im Hook')

  console.log('patchnotes-gestagt: ok')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
