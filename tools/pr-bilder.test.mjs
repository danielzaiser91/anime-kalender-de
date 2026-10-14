/**
 * Test für `tools/pr-bilder.mjs`: an einem temporären Repo mit einem Pre-Commit-Hook, der immer scheitert.
 * Der Bilderzweig muss trotzdem entstehen (kein Hook beteiligt), ohne Vorgänger, flach, mit Byte-gleichem Inhalt.
 * Aufruf: node tools/pr-bilder.test.mjs
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { baumZeilen, bildLinks, eingabeFehler, repoAus } from './pr-bilder.mjs'

const WERKZEUG = fileURLToPath(new URL('./pr-bilder.mjs', import.meta.url))
const GIT = process.env.GIT || 'git'
const KENNUNG = { GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' }

const git = (cwd, ...args) => execFileSync(GIT, args, { cwd, encoding: 'utf8', env: { ...process.env, ...KENNUNG } }).trim()
const werkzeug = (cwd, ...args) => spawnSync(process.execPath, [WERKZEUG, ...args], { cwd, encoding: 'utf8', env: { ...process.env, ...KENNUNG } })

// Reine Funktionen.
assert.equal(repoAus('https://github.com/danielzaiser91/anime-kalender-de.git'), 'danielzaiser91/anime-kalender-de')
assert.equal(repoAus('git@github.com:a/b'), 'a/b')
assert.equal(repoAus('C:/irgendwo/remote.git'), null)
assert.equal(baumZeilen({ 'a.png': 'h1', 'b.png': 'h2' }), '100644 blob h1\ta.png\n100644 blob h2\tb.png\n')
assert.deepEqual(bildLinks('o/r', 'x', ['p/a b.png']), ['![a b.png](https://raw.githubusercontent.com/o/r/bilder/x/a%20b.png)'])
assert.deepEqual(eingabeFehler('gut-1', []), ['Keine Bilddatei angegeben.'])
assert.equal(eingabeFehler('Schlecht', ['x.png']).length, 2) // Name ungültig, Datei fehlt
assert.match(eingabeFehler('gut', ['x.txt']).join(), /kein Bild/)
assert.match(eingabeFehler('gut', ['a/x.png', 'b/x.png']).join(), /mehrfach/)

// Ablauf an einem echten Repo.
const wurzel = mkdtempSync(path.join(tmpdir(), 'pr-bilder-test-'))
try {
  const fern = path.join(wurzel, 'fern.git')
  const arbeit = path.join(wurzel, 'arbeit')
  mkdirSync(arbeit)
  git(wurzel, 'init', '--bare', 'fern.git')
  git(arbeit, 'init')
  git(arbeit, 'remote', 'add', 'origin', fern)
  writeFileSync(path.join(arbeit, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\necho "Hook lief" >&2\nexit 1\n', { mode: 0o755 })

  // Eine Textregel darf die Bildbytes nicht umschreiben (--no-filters).
  writeFileSync(path.join(arbeit, '.gitattributes'), '*.png text eol=lf\n')

  // Bytes mit NUL, CRLF und hohen Werten: dürfen nicht verändert werden.
  const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff, 0x0d, 0x0a])
  const vorher = path.join(arbeit, 'vorher.png')
  const nachher = path.join(arbeit, 'nachher.png')
  writeFileSync(vorher, bytes)
  writeFileSync(nachher, Buffer.concat([bytes, Buffer.from([1])]))

  const lauf = werkzeug(arbeit, 'panel-test', vorher, nachher)
  assert.equal(lauf.status, 0, lauf.stderr)
  assert.doesNotMatch(lauf.stderr, /Hook lief/)
  const kopf = /= ([0-9a-f]{40})/.exec(lauf.stdout)[1]
  assert.equal(git(fern, 'rev-parse', 'refs/heads/bilder/panel-test'), kopf)
  assert.equal(git(fern, 'rev-list', '--parents', '-n', '1', kopf), kopf, 'Zweig hat einen Vorgänger')
  assert.equal(git(fern, 'ls-tree', '--name-only', '-r', kopf), 'nachher.png\nvorher.png')
  assert.deepEqual(execFileSync(GIT, ['cat-file', 'blob', `${kopf}:vorher.png`], { cwd: fern }), bytes)

  // Der Hook wurde nicht umgangen: keine Hook-Einstellung im Repo, und ein echter Commit scheitert weiter am Hook.
  assert.equal(spawnSync(GIT, ['config', '--get', 'core.hooksPath'], { cwd: arbeit }).status, 1)
  git(arbeit, 'add', 'vorher.png')
  assert.throws(() => execFileSync(GIT, ['commit', '-m', 'x'], { cwd: arbeit, stdio: 'pipe', env: { ...process.env, ...KENNUNG } }))

  // Ein vorhandener Zweig wird nur mit --ersetzen überschrieben.
  writeFileSync(vorher, Buffer.from([7, 7, 7]))
  const zweiter = werkzeug(arbeit, 'panel-test', vorher)
  assert.notEqual(zweiter.status, 0)
  assert.equal(git(fern, 'rev-parse', 'refs/heads/bilder/panel-test'), kopf)
  const ersetzt = werkzeug(arbeit, 'panel-test', vorher, '--ersetzen')
  assert.equal(ersetzt.status, 0, ersetzt.stderr)
  const neuerKopf = /= ([0-9a-f]{40})/.exec(ersetzt.stdout)[1]
  assert.equal(git(fern, 'rev-parse', 'refs/heads/bilder/panel-test'), neuerKopf)
  assert.equal(git(fern, 'ls-tree', '--name-only', '-r', neuerKopf), 'vorher.png')

  // Falsche Eingabe: Exit 1, nichts gepusht.
  assert.equal(werkzeug(arbeit, 'Falsch Name', vorher).status, 1)
  assert.equal(git(fern, 'branch', '--list', 'bilder/*').split('\n').length, 1)
  console.log('pr-bilder.test: ok')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
