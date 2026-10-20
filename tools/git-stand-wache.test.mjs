/**
 * Prüft `gitStand`/`veraenderte`: fremde `_wt-*`-Arbeitsbäume zählen nicht (20.10.2026: das Abräumen eines
 * ungetrackten `_wt-*`-Ordners ließ `arbeiterpool.mjs` „getrackte Dateien verändert“ melden), echte Änderungen schon.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gitStand, veraenderte } from './git-stand-wache.mjs'

const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'ignore' })
const wurzel = mkdtempSync(join(tmpdir(), 'stand-wache-'))
git(wurzel, 'init', '-q')
writeFileSync(join(wurzel, 'a.txt'), 'eins\n')
git(wurzel, 'add', 'a.txt')
git(wurzel, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'eins')

/* Fremder Arbeitsbaum ohne eigenes .git (Rest eines abgeräumten Worktrees) erscheint und verschwindet. */
mkdirSync(join(wurzel, '_wt-fremd'))
writeFileSync(join(wurzel, '_wt-fremd', 'x.txt'), 'x')
const vorher = gitStand(wurzel)
rmSync(join(wurzel, '_wt-fremd'), { recursive: true })
assert.deepEqual(veraenderte(vorher, gitStand(wurzel)), [], 'Verschwinden eines _wt-Ordners ist keine Veränderung')
mkdirSync(join(wurzel, '_wt-fremd2'))
writeFileSync(join(wurzel, '_wt-fremd2', 'y.txt'), 'y')
assert.deepEqual(veraenderte(vorher, gitStand(wurzel)), [], 'Entstehen eines _wt-Ordners ist keine Veränderung')
rmSync(join(wurzel, '_wt-fremd2'), { recursive: true })

/* Gegenproben: dieselbe Schreibung außerhalb von _wt-* wird gemeldet. */
writeFileSync(join(wurzel, 'neu.txt'), 'n')
const mitNeu = gitStand(wurzel)
assert.deepEqual(veraenderte(vorher, mitNeu), ['neu.txt'], 'neue ungetrackte Datei')
rmSync(join(wurzel, 'neu.txt'))
assert.deepEqual(veraenderte(mitNeu, gitStand(wurzel)), ['neu.txt'], 'verschwundene ungetrackte Datei')
writeFileSync(join(wurzel, 'a.txt'), 'zwei\n')
assert.deepEqual(veraenderte(vorher, gitStand(wurzel)), ['a.txt'], 'getrackte Datei geändert')
assert.deepEqual(veraenderte(gitStand(wurzel), gitStand(wurzel)), [], 'zwei Aufnahmen ohne Änderung')

rmSync(wurzel, { recursive: true, force: true })
console.log('git-stand-wache: alle Fälle grün (_wt-Ordner ignoriert, neue/verschwundene/geänderte Dateien gemeldet)')
