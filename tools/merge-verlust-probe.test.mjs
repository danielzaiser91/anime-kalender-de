/** Test für `tools/merge-verlust-probe.mjs` in Wegwerf-Repos unter os.tmpdir(). */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const probe = join(import.meta.dirname, 'merge-verlust-probe.mjs')

function git(cwd, ...args) {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8', timeout: 30_000, windowsHide: true })
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`)
}

/** Repo mit Basis-Stand (Branch main) und einem Kopf-Commit auf Zweig pr; liefert den Probe-Lauf. */
function lauf(basis, aenderungen) {
  const dir = mkdtempSync(join(tmpdir(), 'verlustprobe-'))
  try {
    git(dir, 'init', '-q', '-b', 'main')
    for (const [name, text] of Object.entries(basis)) writeFileSync(join(dir, name), text)
    git(dir, 'add', '.')
    git(dir, 'commit', '-q', '-m', 'basis')
    git(dir, 'checkout', '-q', '-b', 'pr')
    for (const [name, text] of Object.entries(aenderungen)) {
      if (text === null) unlinkSync(join(dir, name))
      else writeFileSync(join(dir, name), text)
    }
    git(dir, 'add', '-A')
    git(dir, 'commit', '-q', '-m', 'kopf')
    const r = spawnSync(process.execPath, [probe, 'main', 'pr'], { cwd: dir, encoding: 'utf8', timeout: 30_000, windowsHide: true })
    return { status: r.status, out: r.stdout + r.stderr }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// (a) Zeile von main fehlt im Kopf: Exit 1 mit genau dieser Zeile
const a = lauf({ 'a.md': 'eins\nWichtiger Satz von main.\nzwei\n' }, { 'a.md': 'eins\nzwei\n' })
assert.equal(a.status, 1, a.out)
assert.match(a.out, /^a\.md: 1 verloren$/m)
assert.match(a.out, /^ {2}- Wichtiger Satz von main\.$/m)
assert.match(a.out, /1 Zeilen verloren, 0 Dateien gelöscht/)

// (b) nur Hinzufügen: Exit 0 (auch Zeile mit Anfang "--" im Inhalt ist kein Kopf)
const b = lauf({ 'b.md': 'eins\n' }, { 'b.md': 'eins\nzwei\n' })
assert.equal(b.status, 0, b.out)
assert.match(b.out, /0 Zeilen verloren, 0 Dateien gelöscht/)

// (c) Ersetzung durch längere Zeile, die den alten Text enthält: Exit 0
const c = lauf({ 'c.md': 'alter Satz\n' }, { 'c.md': '  Der alter Satz, jetzt länger.\n' })
assert.equal(c.status, 0, c.out)

// (d) gewollte echte Ersetzung wird trotzdem gemeldet
const d = lauf({ 'd.md': 'x\nalter Satz\ny\n' }, { 'd.md': 'x\nganz anderer Text\ny\n' })
assert.equal(d.status, 1, d.out)
assert.match(d.out, /^d\.md: 1 verloren$/m)
assert.match(d.out, /alter Satz/)

// (e) gelöschte Datei wird gemeldet
const e = lauf({ 'e.md': 'inhalt\n', 'f.md': 'bleibt\n' }, { 'e.md': null })
assert.equal(e.status, 1, e.out)
assert.match(e.out, /^e\.md: gelöscht$/m)
assert.match(e.out, /0 Zeilen verloren, 1 Dateien gelöscht/)

// (f) Zeile mit führendem "--" im Inhalt zählt als normale Zeile, 120-Zeichen-Kürzung, Randleerzeichen und Leerzeile
const lang = 'L'.repeat(200)
const f = lauf({ 'g.md': `-- Satz mit Strichen\n\n   ${lang}\nrest\n` }, { 'g.md': 'rest\n' })
assert.equal(f.status, 1, f.out)
assert.match(f.out, /^g\.md: 2 verloren$/m)
assert.match(f.out, /^ {2}- -- Satz mit Strichen$/m)
assert.ok(f.out.includes(`  - ${'L'.repeat(120)}\n`), f.out)
assert.ok(!f.out.includes('L'.repeat(121)), 'auf 120 Zeichen gekürzt')

console.log('merge-verlust-probe.test: 6 Fälle grün (a Verlust, b Zusatz, c Erweiterung, d Ersetzung, e gelöscht, f Sonderformen)')
