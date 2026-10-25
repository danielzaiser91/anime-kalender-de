/**
 * Prüft `legeWorktreeAn`: Arbeit auf origin/main in eigenem Ordner, Hauptordner unberührt, Aufräumen auch nach `process.exit`.
 * Wegwerf-Repos unter `os.tmpdir()`.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { legeWorktreeAn, restzweigHinweis } from './erneut-melden-worktree.mjs'

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const wurzel = mkdtempSync(join(tmpdir(), 'erneut-wt-'))
const ursprung = join(wurzel, 'ursprung.git')
const haupt = join(wurzel, 'haupt')
const zweiter = join(wurzel, 'zweiter')
const persoenlich = ['-c', 'user.name=t', '-c', 'user.email=t@t']

git(wurzel, 'init', '-q', '--bare', '-b', 'main', ursprung)
git(wurzel, 'clone', '-q', ursprung, haupt)
writeFileSync(join(haupt, 'a.txt'), 'eins\n')
git(haupt, 'add', 'a.txt')
git(haupt, ...persoenlich, 'commit', '-q', '-m', 'eins')
git(haupt, 'push', '-q', 'origin', 'HEAD:main')
git(haupt, 'branch', '-q', '-u', 'origin/main')
mkdirSync(join(haupt, 'node_modules'))
writeFileSync(join(haupt, 'node_modules', 'x.txt'), 'x')
/* Ein zweiter Klon schiebt origin/main vor; der Hauptordner bleibt zurück (er zieht nur mit `pull --ff-only`). */
git(wurzel, 'clone', '-q', ursprung, zweiter)
writeFileSync(join(zweiter, 'b.txt'), 'zwei\n')
git(zweiter, 'add', 'b.txt')
git(zweiter, ...persoenlich, 'commit', '-q', '-m', 'zwei')
git(zweiter, 'push', '-q', 'origin', 'HEAD:main')

const stand = () => git(haupt, 'status', '--porcelain').split('\n').filter((z) => z && !z.includes('_wt-') && !z.includes('node_modules'))
const kopf = git(haupt, 'rev-parse', 'HEAD')

const w = legeWorktreeAn(haupt, '20990101000000')
assert.ok(existsSync(join(w.pfad, 'b.txt')), 'Arbeitsbaum steht auf origin/main (mit dem neuen Commit)')
assert.ok(!existsSync(join(haupt, 'b.txt')), 'Hauptordner bleibt auf seinem Stand')
assert.equal(readFileSync(join(w.pfad, 'node_modules', 'x.txt'), 'utf8'), 'x', 'node_modules als Junction')
writeFileSync(join(w.pfad, 'neu.txt'), 'n')
git(w.pfad, 'add', 'neu.txt')
git(w.pfad, ...persoenlich, 'commit', '-q', '-m', 'im Arbeitsbaum')
assert.equal(git(w.pfad, 'rev-parse', '--abbrev-ref', 'HEAD'), 'erneut-melden/20990101000000', 'Zweig im Arbeitsbaum')
assert.equal(git(haupt, 'rev-parse', '--abbrev-ref', 'HEAD'), 'main', 'Hauptordner bleibt auf main')
assert.equal(git(haupt, 'rev-parse', 'HEAD'), kopf, 'Hauptordner: kein neuer Commit')
assert.deepEqual(stand(), [], 'Hauptordner: keine Änderung')

w.aufraeumen()
w.aufraeumen()
assert.ok(!existsSync(w.pfad), 'Arbeitsbaum entfernt')
assert.equal(readFileSync(join(haupt, 'node_modules', 'x.txt'), 'utf8'), 'x', 'node_modules des Hauptordners bleibt voll')
assert.equal(git(haupt, 'branch', '--list', 'erneut-melden/*'), '', 'Zweig entfernt')
assert.deepEqual(stand(), [], 'Hauptordner nach dem Aufräumen unverändert')

/* Zweiter Lauf mit demselben Stempel (Abbruch davor hat aufgeräumt) und Abbruch per process.exit. */
const kind = join(wurzel, 'kind.mjs')
writeFileSync(
  kind,
  `import { legeWorktreeAn } from ${JSON.stringify(pathToFileURL(join(import.meta.dirname, 'erneut-melden-worktree.mjs')).href)}\n` +
    `const w = legeWorktreeAn(${JSON.stringify(haupt)}, '20990101000000')\n` +
    `process.on('exit', w.aufraeumen)\nprocess.exit(1)\n`,
)
try {
  execFileSync(process.execPath, [kind], { stdio: 'pipe' })
  assert.fail('Kindprozess sollte mit 1 enden')
} catch (e) {
  assert.equal(e.status, 1)
}
assert.ok(!existsSync(join(haupt, '_wt-erneut-melden-20990101000000')), 'nach process.exit aufgeräumt')
assert.equal(git(haupt, 'branch', '--list', 'erneut-melden/*'), '', 'Zweig nach process.exit entfernt')
assert.deepEqual(stand(), [], 'Hauptordner nach Abbruch unverändert')

/* Junction scheitert (node_modules ist verknüpft, data/cache existiert im Arbeitsbaum schon): Wurf, aber nichts bleibt liegen. */
mkdirSync(join(zweiter, 'data', 'cache'), { recursive: true })
writeFileSync(join(zweiter, 'data', 'cache', 'k.txt'), 'k')
git(zweiter, 'add', '-A')
git(zweiter, ...persoenlich, 'commit', '-q', '-m', 'cache verfolgt')
git(zweiter, 'push', '-q', 'origin', 'HEAD:main')
mkdirSync(join(haupt, 'data', 'cache'), { recursive: true })
assert.throws(() => legeWorktreeAn(haupt, '20990101000001'), /EEXIST/, 'Junction-Fehlschlag wirft weiter')
assert.ok(!existsSync(join(haupt, '_wt-erneut-melden-20990101000001')), 'Junction-Fehlschlag: Arbeitsbaum entfernt')
assert.equal(git(haupt, 'branch', '--list', 'erneut-melden/*'), '', 'Junction-Fehlschlag: Zweig entfernt')
assert.equal(git(haupt, 'worktree', 'list', '--porcelain').split('\n').filter((z) => z.startsWith('worktree ')).length, 1, 'Junction-Fehlschlag: kein Arbeitsbaum registriert')
assert.equal(readFileSync(join(haupt, 'node_modules', 'x.txt'), 'utf8'), 'x', 'Junction-Fehlschlag: node_modules des Hauptordners bleibt voll')
assert.deepEqual(stand(), [], 'Junction-Fehlschlag: Hauptordner unverändert')

/* Restzweig: gemeldet, nie gelöscht. */
assert.equal(restzweigHinweis(haupt, 'erneut-melden/20990101000002'), null, 'Restzweig: nichts auf origin, kein Hinweis')
git(haupt, 'push', '-q', 'origin', 'HEAD:refs/heads/erneut-melden/20990101000002')
const hinweis = restzweigHinweis(haupt, 'erneut-melden/20990101000002')
assert.match(hinweis, /^Zweig erneut-melden\/20990101000002 liegt auf origin/, 'Restzweig: Hinweis nennt den Zweig')
assert.ok(hinweis.includes('git push origin --delete erneut-melden/20990101000002'), 'Restzweig: Löschbefehl steht im Hinweis')
assert.ok(hinweis.includes('gh pr list --head erneut-melden/20990101000002'), 'Restzweig: Prüfbefehl steht im Hinweis')
assert.match(git(haupt, 'ls-remote', '--heads', 'origin', 'erneut-melden/20990101000002'), /refs\/heads\/erneut-melden\/20990101000002/, 'Restzweig: nach dem Hinweis nicht gelöscht')
assert.equal(restzweigHinweis(haupt, 'erneut-melden/20990101000003'), null, 'Restzweig: anderer Zweig daneben zählt nicht')
const ohneOrigin = join(wurzel, 'ohne-origin')
mkdirSync(ohneOrigin)
git(ohneOrigin, 'init', '-q')
assert.match(restzweigHinweis(ohneOrigin, 'erneut-melden/x'), /ließ sich nicht prüfen/, 'Restzweig: Abruffehler wird gemeldet, nicht verschwiegen')

rmSync(wurzel, { recursive: true, force: true })
console.log('erneut-melden-worktree: alle Fälle grün (Stand origin/main, Hauptordner unberührt, Aufräumen bei Abbruch, zweiter Lauf, Junction-Fehlschlag, Restzweig)')
