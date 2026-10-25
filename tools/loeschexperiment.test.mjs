import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { experiment, liesArgumente, pruefePfade, stelleWieder } from './loeschexperiment.mjs'
import { bilanz, letzteZeilen, vergleicheLauf } from './loeschexperiment-vergleich.mjs'

const ok = { code: 0, ende: 'a' }
assert.equal(vergleicheLauf(ok, { code: 0, ende: 'b' }), 'gleich')
assert.equal(vergleicheLauf(ok, { code: 1, ende: 'a' }), 'neu rot')
assert.equal(vergleicheLauf({ code: 2, ende: 'x' }, ok), 'neu grün')
assert.equal(vergleicheLauf({ code: 1, ende: 'x' }, { code: 1, ende: 'x' }), 'gleich')
assert.equal(vergleicheLauf({ code: 1, ende: 'x' }, { code: 3, ende: 'y' }), 'rot, anderes Ende')
assert.equal(letzteZeilen('1\n\n2\r\n3\n4\n', 2), '3\n4')
const b = bilanz({ p: { basis: ok, nach: ok }, q: { basis: ok, nach: { code: 1, ende: '' } } })
assert.deepEqual(b.zeilen.map((z) => z.urteil), ['gleich', 'neu rot'])
assert.equal(b.abweichend, 1)
assert.deepEqual(liesArgumente(['a', 'b', '--pruefung', 'x', 'y', '--cache']), { pfade: ['a', 'b'], pruefungen: ['x', 'y'], cache: true })
assert.deepEqual(liesArgumente(['a']).pruefungen, ['check:pfade', 'typecheck', 'check:hooks'])

// Ablauf in einem Wegwerf-Repo: nur die genannten Pfade verschwinden und kommen zurück, Fremdes bleibt.
const wurzel = mkdtempSync(join(tmpdir(), 'loeschexp-'))
const git = (...a) => spawnSync('git', a, { cwd: wurzel, encoding: 'utf8', windowsHide: true })
git('init', '-q')
mkdirSync(join(wurzel, 'ordner'))
writeFileSync(join(wurzel, 'ordner', 'a.txt'), 'A')
writeFileSync(join(wurzel, 'b.txt'), 'B')
writeFileSync(join(wurzel, 'neben.txt'), 'N')
git('add', '.')
git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'x')
writeFileSync(join(wurzel, 'fremd.txt'), 'F') // ungetrackt, darf nie angefasst werden
assert.match(pruefePfade(wurzel, ['fremd.txt']), /nicht in git getrackt/)
assert.match(pruefePfade(wurzel, ['../x']), /außerhalb/)
assert.match(pruefePfade(wurzel, []), /Kein Pfad/)
assert.equal(pruefePfade(wurzel, ['ordner', 'b.txt']), '')
writeFileSync(join(wurzel, 'b.txt'), 'B2')
assert.match(pruefePfade(wurzel, ['b.txt']), /lokale oder ignorierte/)
git('checkout', '--', 'b.txt')

const gesehen = []
const lauf = (w, p) => {
  gesehen.push(existsSync(join(w, 'ordner', 'a.txt')))
  return { code: existsSync(join(w, 'b.txt')) ? 0 : 1, ende: p }
}
const erg = await experiment(wurzel, { pfade: ['ordner', 'b.txt'], pruefungen: ['p1', 'p2'] }, lauf)
assert.deepEqual(gesehen, [true, true, false, false])
assert.deepEqual(erg.zeilen.map((z) => z.urteil), ['neu rot', 'neu rot'])
assert.equal(readFileSync(join(wurzel, 'ordner', 'a.txt'), 'utf8'), 'A')
assert.equal(readFileSync(join(wurzel, 'b.txt'), 'utf8'), 'B')
assert.equal(readFileSync(join(wurzel, 'fremd.txt'), 'utf8'), 'F')
assert.equal(git('status', '--porcelain').stdout.trim(), '?? fremd.txt')
// Fällt der zweite Lauf aus, wird trotzdem wiederhergestellt.
await assert.rejects(experiment(wurzel, { pfade: ['b.txt'], pruefungen: ['p'] }, (w) => { if (!existsSync(join(w, 'b.txt'))) throw new Error('boom'); return ok }), /boom/)
assert.equal(readFileSync(join(wurzel, 'b.txt'), 'utf8'), 'B')
// Scheitert das Löschen des zweiten Pfads, kommt der erste trotzdem zurück.
await assert.rejects(experiment(wurzel, { pfade: ['ordner', 'b.txt/x'], pruefungen: ['p'] }, () => ok))
assert.equal(readFileSync(join(wurzel, 'ordner', 'a.txt'), 'utf8'), 'A')
// Ignorierte Datei im Ordner: git stellt sie nicht her, also Abweisung vor dem Löschen.
writeFileSync(join(wurzel, '.gitignore'), 'roh.tmp\n')
git('add', '.gitignore')
git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'ign')
writeFileSync(join(wurzel, 'ordner', 'roh.tmp'), 'R')
assert.match(pruefePfade(wurzel, ['ordner']), /ignorierte/)
rmSync(join(wurzel, 'ordner', 'roh.tmp'))
assert.equal(pruefePfade(wurzel, ['ordner']), '')
// Scheitert git checkout, ist das ein Fehler, kein stilles Weitermachen.
assert.throws(() => stelleWieder(wurzel, ['gibt-es-nicht']), /Wiederherstellung gescheitert/)
rmSync(wurzel, { recursive: true, force: true })
console.log('loeschexperiment.test: alle Fälle grün (Urteile, Argumente, Pfadprüfung inkl. ignoriert, Wiederherstellung, Abbruch, Löschfehler)')
