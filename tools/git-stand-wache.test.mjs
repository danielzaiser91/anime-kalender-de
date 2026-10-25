/**
 * Prüft `gitStand`/`veraenderte`: neue, verschwundene und geänderte Dateien werden gemeldet. Arbeitsbäume liegen seit 25.10.2026
 * außerhalb des Repos (C:/code/_worktrees), darum gibt es keine Ausnahme für `_wt-*` im Repo mehr.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gitStand, veraenderte } from './git-stand-wache.mjs'

const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'ignore' })
const wurzel = mkdtempSync(join(tmpdir(), 'stand-wache-'))
git(wurzel, 'init', '-q')
writeFileSync(join(wurzel, 'a.txt'), 'eins\n')
git(wurzel, 'add', 'a.txt')
git(wurzel, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'eins')

const vorher = gitStand(wurzel)

/* Eine ungetrackte `_wt-`-Datei im Repo ist keine Ausnahme mehr: sie wird gemeldet wie jede andere. */
writeFileSync(join(wurzel, '_wt-alt.txt'), 'x')
assert.deepEqual(veraenderte(vorher, gitStand(wurzel)), ['_wt-alt.txt'], '_wt-Datei wird gemeldet')
rmSync(join(wurzel, '_wt-alt.txt'))

writeFileSync(join(wurzel, 'neu.txt'), 'n')
const mitNeu = gitStand(wurzel)
assert.deepEqual(veraenderte(vorher, mitNeu), ['neu.txt'], 'neue ungetrackte Datei')
rmSync(join(wurzel, 'neu.txt'))
assert.deepEqual(veraenderte(mitNeu, gitStand(wurzel)), ['neu.txt'], 'verschwundene ungetrackte Datei')
writeFileSync(join(wurzel, 'a.txt'), 'zwei\n')
assert.deepEqual(veraenderte(vorher, gitStand(wurzel)), ['a.txt'], 'getrackte Datei geändert')
assert.deepEqual(veraenderte(gitStand(wurzel), gitStand(wurzel)), [], 'zwei Aufnahmen ohne Änderung')

rmSync(wurzel, { recursive: true, force: true })
console.log('git-stand-wache: alle Fälle grün (neue/verschwundene/geänderte Dateien gemeldet, keine _wt-Ausnahme)')
