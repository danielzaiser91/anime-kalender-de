/**
 * Test zu tools/pr-nur-mod.mjs: reine Regel (istNurMod, leseRaw) und der echte Aufruf gegen Wegwerf-Repos (auch im flachen Klon, so klont die CI).
 * Aufruf: node tools/pr-nur-mod.test.mjs
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { istNurMod, leseRaw } from './pr-nur-mod.mjs'

const MOD = '.claude/mods/arbeitsliste/hooks/kalender.ts'
const SKILL = '.claude/skills/daniel-dateien-pflegen/SKILL.md'
const f = (pfad, extra = {}) => ({ pfad, ...extra })

// Regel
assert.equal(istNurMod([f(MOD)]), true, 'nur Mod')
assert.equal(istNurMod([f(MOD), f(SKILL)]), true, 'Mod + Skill-Markdown')
assert.equal(istNurMod([f(SKILL)]), false, 'nur Skill: kein Schnellweg')
assert.equal(istNurMod([]), false, 'leerer Diff')
assert.equal(istNurMod([f(MOD), f('.claude/mods/andere/x.ts')]), false, 'andere Mod')
assert.equal(istNurMod([f(MOD), f('.claude/mods/arbeitsliste-x/a.ts')]), false, 'Namenspräfix')
assert.equal(istNurMod([f(MOD), f('.claude/rules/10-x.md')]), false, 'Regel')
assert.equal(istNurMod([f(MOD), f('docs/a.md')]), false, 'Doku')
assert.equal(istNurMod([f(MOD), f('.claude/skills/x/lauf.mjs')]), false, 'Skill-Skript')
assert.equal(istNurMod([f('.claude/mods/arbeitsliste/../../hooks/a.js')]), false, 'Pfadsprung')
assert.equal(istNurMod([f(MOD, { symlink: true })]), false, 'Symlink')
assert.equal(istNurMod([f(MOD, { modus: true })]), false, 'Moduswechsel')
assert.equal(istNurMod([f(MOD, { unlesbar: true })]), false, 'unlesbar')
assert.equal(istNurMod([f(MOD, { quelle: 'pipeline/a.ts' })]), false, 'Umbenennung von außerhalb')
assert.equal(istNurMod([f(MOD, { quelle: '.claude/mods/arbeitsliste/b.ts' })]), true, 'Umbenennung innerhalb')
assert.equal(istNurMod([f('.claude/mods/arbeitsliste/"x.ts')]), false, 'Anführungszeichen im Pfad')

// leseRaw: echtes Format von `git diff --raw -z`
const raw = ':100644 100644 aaaaaaa bbbbbbb M\0.claude/mods/arbeitsliste/a.ts\0:000000 100644 0000000 ccccccc A\0.claude/mods/arbeitsliste/n.ts\0:100644 100755 aaaaaaa bbbbbbb M\0x.sh\0:100644 120000 aaaaaaa bbbbbbb T\0l\0'
assert.deepEqual(leseRaw(raw), [
  { pfad: '.claude/mods/arbeitsliste/a.ts', symlink: false, modus: false },
  { pfad: '.claude/mods/arbeitsliste/n.ts', symlink: false, modus: false },
  { pfad: 'x.sh', symlink: false, modus: true },
  { pfad: 'l', symlink: true, modus: true },
])
assert.equal(leseRaw('')[0], undefined, 'leere Ausgabe: keine Dateien')
assert.equal(leseRaw('Müll\0a\0')[0].unlesbar, true, 'unbekanntes Format ist unlesbar')

// Echter Aufruf gegen Wegwerf-Repos
const wurzel = mkdtempSync(join(tmpdir(), 'pr-nur-mod-'))
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], { cwd, encoding: 'utf8', windowsHide: true })
const skript = join(import.meta.dirname, 'pr-nur-mod.mjs')
const lauf = (cwd, a = 'HEAD^1', b = 'HEAD') => {
  const r = spawnSync(process.execPath, [skript, a, b], { cwd, encoding: 'utf8', windowsHide: true })
  assert.equal(r.status, 0, `Exit 0 erwartet: ${r.stderr}`)
  return r.stdout.trim()
}
/** Repo mit Basis-Commit und einem Änderungs-Commit; `aendere(ordner)` schreibt die Änderung. */
function repo(name, aendere) {
  const ordner = join(wurzel, name)
  mkdirSync(join(ordner, '.claude/mods/arbeitsliste/hooks'), { recursive: true })
  mkdirSync(join(ordner, 'pipeline'), { recursive: true })
  writeFileSync(join(ordner, '.claude/mods/arbeitsliste/hooks/kalender.ts'), 'a\n')
  writeFileSync(join(ordner, 'pipeline/x.ts'), 'a\n')
  git(ordner, 'init', '-q')
  git(ordner, 'add', '-A')
  git(ordner, 'commit', '-q', '-m', 'basis')
  if (aendere(ordner) !== 'gestaged') git(ordner, 'add', '-A')
  git(ordner, 'commit', '-q', '-m', 'pr')
  return ordner
}
try {
  const nurMod = repo('mod', (o) => writeFileSync(join(o, MOD), 'b\n'))
  assert.equal(lauf(nurMod), 'nur_mod=1', 'nur Mod-Datei')
  assert.equal(lauf(repo('gemischt', (o) => { writeFileSync(join(o, MOD), 'b\n'); writeFileSync(join(o, 'pipeline/x.ts'), 'b\n') })), 'nur_mod=0', 'Mod + pipeline')
  assert.equal(lauf(repo('neuer-skill', (o) => { mkdirSync(join(o, '.claude/skills/s'), { recursive: true }); writeFileSync(join(o, SKILL.replace('daniel-dateien-pflegen', 's')), 'x\n'); writeFileSync(join(o, MOD), 'b\n') })), 'nur_mod=1', 'Mod + Skill-Markdown')
  assert.equal(lauf(repo('modus', (o) => { git(o, 'update-index', '--chmod=+x', MOD); return 'gestaged' })), 'nur_mod=0', 'Moduswechsel')
  assert.equal(lauf(repo('symlink', (o) => {
    const blob = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: o, input: 'ziel', encoding: 'utf8', windowsHide: true }).trim()
    git(o, 'update-index', '--add', '--cacheinfo', `120000,${blob},.claude/mods/arbeitsliste/link`)
    return 'gestaged'
  })), 'nur_mod=0', 'Symlink in der Mod')
  // Umbenennung pipeline -> Mod: ohne Renamerkennung steht die Quelle als gelöschte Datei im Diff
  assert.equal(lauf(repo('umzug', (o) => git(o, 'mv', 'pipeline/x.ts', '.claude/mods/arbeitsliste/hooks/x.ts'))), 'nur_mod=0', 'Umzug aus pipeline')
  assert.equal(lauf(repo('geloescht', (o) => git(o, 'rm', '-q', MOD))), 'nur_mod=1', 'Mod-Datei gelöscht')
  assert.equal(lauf(nurMod, 'HEAD^1', 'gibtsnicht'), 'nur_mod=0', 'Abruffehler: volle Kette, Exit 0')
  // Flacher Klon (Tiefe 2) wie der Checkout der CI: HEAD^1 muss erreichbar sein
  const klon = join(wurzel, 'klon')
  execFileSync('git', ['clone', '-q', '--depth=2', `file://${nurMod.replaceAll('\\', '/')}`, klon], { encoding: 'utf8', windowsHide: true })
  assert.equal(lauf(klon), 'nur_mod=1', 'flacher Klon, nur Mod')
  const r = spawnSync(process.execPath, [skript, 'a'], { encoding: 'utf8', windowsHide: true })
  assert.equal(r.status, 2, 'falscher Aufruf: Exit 2')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
console.log('pr-nur-mod: Regelfälle, Formatfälle und Fälle gegen echtes git (auch flacher Klon) grün')
