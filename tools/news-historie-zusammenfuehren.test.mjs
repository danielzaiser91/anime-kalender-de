import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fuehreZusammen } from './news-historie-zusammenfuehren.mjs'

const SKRIPT = fileURLToPath(new URL('./news-historie-zusammenfuehren.mjs', import.meta.url))
const basis = { zuerst: { 'neu:1': '2026-09-01' }, felder: { 'neu:1': { a: 1 }, 'neu:2': { b: 2 } }, termine: { t1: [{ x: 1 }] } }

// nur im PR: neuer Eintrag und neues Feld in vorhandenem Eintrag
{
  const pr = { ...basis, zuerst: { ...basis.zuerst, 'neu:9': '2026-10-01' }, felder: { ...basis.felder, 'neu:1': { a: 1, c: 3 } } }
  const r = fuehreZusammen(basis, pr, basis)
  assert.deepEqual(r.ergebnis, pr)
  assert.deepEqual(r.uebernommen, { zuerst: 1, felder: 1, termine: 0 })
}
// nur auf main: bleibt, nichts übernommen
{
  const haupt = { ...basis, zuerst: { ...basis.zuerst, 'neu:7': '2026-10-02' } }
  const r = fuehreZusammen(basis, basis, haupt)
  assert.deepEqual(r.ergebnis, haupt)
  assert.deepEqual(r.uebernommen, { zuerst: 0, felder: 0, termine: 0 })
}
// beides, verschiedene Einträge und verschiedene Felder desselben Eintrags
{
  const pr = { ...basis, zuerst: { ...basis.zuerst, 'neu:9': 'p' }, felder: { ...basis.felder, 'neu:1': { a: 1, c: 3 } } }
  const haupt = { ...basis, zuerst: { ...basis.zuerst, 'neu:7': 'm' }, felder: { ...basis.felder, 'neu:1': { a: 1, d: 4 } } }
  const r = fuehreZusammen(basis, pr, haupt)
  assert.deepEqual(r.ergebnis.zuerst, { 'neu:1': '2026-09-01', 'neu:7': 'm', 'neu:9': 'p' })
  assert.deepEqual(r.ergebnis.felder['neu:1'], { a: 1, c: 3, d: 4 })
  assert.deepEqual(r.uebernommen, { zuerst: 1, felder: 1, termine: 0 })
}
// beide setzen dasselbe: kein Widerspruch, nicht gezählt
{
  const geaendert = { ...basis, felder: { ...basis.felder, 'neu:2': { b: 5 } } }
  const r = fuehreZusammen(basis, geaendert, geaendert)
  assert.deepEqual(r.ergebnis, geaendert)
  assert.equal(r.uebernommen.felder, 0)
}
// PR löscht einen Eintrag, den main nicht angefasst hat
{
  const pr = { ...basis, felder: { 'neu:1': { a: 1 } } }
  const r = fuehreZusammen(basis, pr, basis)
  assert.deepEqual(Object.keys(r.ergebnis.felder), ['neu:1'])
  assert.equal(r.uebernommen.felder, 1)
}
// Widerspruch: Feld verschieden / Liste verschieden / PR löscht, was main ändert -> Fehler
assert.throws(
  () => fuehreZusammen(basis, { ...basis, felder: { ...basis.felder, 'neu:1': { a: 2 } } }, { ...basis, felder: { ...basis.felder, 'neu:1': { a: 3 } } }),
  /Widerspruch bei felder\/neu:1\/a/,
)
assert.throws(
  () => fuehreZusammen(basis, { ...basis, termine: { t1: [{ x: 2 }] } }, { ...basis, termine: { t1: [{ x: 3 }] } }),
  /Widerspruch bei termine\/t1/,
)
assert.throws(
  () => fuehreZusammen(basis, { ...basis, zuerst: {} }, { ...basis, zuerst: { 'neu:1': 'anders' } }),
  /Widerspruch bei zuerst\/neu:1/,
)
// unbekannter Schlüssel mit Zahl (kein Objekt): als Ganzes
assert.equal(fuehreZusammen({ n: 1 }, { n: 2 }, { n: 1 }).ergebnis.n, 2)

// Zahl: nur main geändert -> main bleibt, 0 gezählt; PR löscht den Schlüssel -> weg
{
  const r = fuehreZusammen({ n: 1 }, { n: 1 }, { n: 5 })
  assert.deepEqual(r, { ergebnis: { n: 5 }, uebernommen: { n: 0 } })
  const l = fuehreZusammen({ n: 1, m: 1 }, { m: 1 }, { n: 1, m: 1 })
  assert.deepEqual(l, { ergebnis: { m: 1 }, uebernommen: { n: 1, m: 0 } })
}
// beide legen denselben Eintrag neu an, mit verschiedenen Feldern -> zusammengeführt
{
  const r = fuehreZusammen({ felder: {} }, { felder: { 'neu:5': { a: 1 } } }, { felder: { 'neu:5': { b: 2 } } })
  assert.deepEqual(r.ergebnis.felder, { 'neu:5': { a: 1, b: 2 } })
}

// Prozess: Format bleibt wie main (einzeilig, mit und ohne Zeilenende), Widerspruch -> Exit 1 ohne Ziel
const dir = mkdtempSync(join(tmpdir(), 'nhz-'))
try {
  const schreibe = (name, o, ende) => writeFileSync(join(dir, name), JSON.stringify(o) + ende)
  const pr = { ...basis, zuerst: { ...basis.zuerst, 'neu:9': 'p' } }
  for (const ende of ['', '\n']) {
    schreibe('b.json', basis, '')
    schreibe('p.json', pr, '')
    schreibe('m.json', basis, ende)
    const r = spawnSync(process.execPath, [SKRIPT, ...['b', 'p', 'm', 'z'].map((n) => join(dir, n + '.json'))], { encoding: 'utf8', windowsHide: true })
    assert.equal(r.status, 0, r.stderr)
    assert.equal(readFileSync(join(dir, 'z.json'), 'utf8'), JSON.stringify(pr) + ende)
    assert.match(r.stdout, /^übernommen zuerst: 1$/m)
    assert.match(r.stdout, /^übernommen felder: 0$/m)
  }
  schreibe('p2.json', { ...basis, felder: { 'neu:1': { a: 2 } } }, '')
  schreibe('m2.json', { ...basis, felder: { 'neu:1': { a: 3 } } }, '')
  rmSync(join(dir, 'z.json'))
  const w = spawnSync(process.execPath, [SKRIPT, ...['b', 'p2', 'm2', 'z'].map((n) => join(dir, n + '.json'))], { encoding: 'utf8', windowsHide: true })
  assert.equal(w.status, 1)
  assert.match(w.stderr, /Widerspruch/)
  assert.throws(() => readFileSync(join(dir, 'z.json')))
  assert.equal(spawnSync(process.execPath, [SKRIPT], { windowsHide: true }).status, 2)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
console.log('news-historie-zusammenfuehren: alle Fälle ok')
