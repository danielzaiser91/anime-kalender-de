/**
 * Test zu `buehne-faelle.mjs --nur <slug>`: nur der eine Fall wird ersetzt, `heute`, `meta` und alle anderen Fälle
 * bleiben byteweise gleich (auch ihre Reihenfolge); unbekannter Fall und fehlende Optionswerte brechen ab.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { leseOptionen, uebernimmFall } from './buehne-faelle-nur.mjs'

const bestehend = {
  heute: '2026-10-11T10:00:00Z',
  meta: { stand: 'x', zahlen: [3, 1, 2] },
  faelle: { a: { name: 'A', titleId: 'ak1', 'events.json': [1] }, b: { name: 'B', titleId: 'ak2', 'events.json': [2, 3] }, c: { name: 'C', titleId: 'ak3' } },
}
const vorher = JSON.stringify(bestehend)
const neu = { name: 'B neu', titleId: 'ak2', 'events.json': [9] }

// Vorher/nachher: nur b ändert sich; alle übrigen Schlüssel sind Zeichen für Zeichen gleich.
const nachher = uebernimmFall(bestehend, 'b', neu)
assert.equal(JSON.stringify(bestehend), vorher, 'die Eingabe bleibt unberührt')
assert.deepEqual(Object.keys(nachher.faelle), ['a', 'b', 'c'], 'der Fall behält seinen Platz')
assert.equal(JSON.stringify(nachher.faelle.b), JSON.stringify(neu))
for (const schluessel of ['a', 'c']) assert.equal(JSON.stringify(nachher.faelle[schluessel]), JSON.stringify(bestehend.faelle[schluessel]))
assert.equal(JSON.stringify(nachher.heute), JSON.stringify(bestehend.heute))
assert.equal(JSON.stringify(nachher.meta), JSON.stringify(bestehend.meta))
// Ganze Datei: nur der Abschnitt von b unterscheidet sich.
assert.equal(JSON.stringify(nachher), vorher.replace(JSON.stringify(bestehend.faelle.b), JSON.stringify(neu)))

// Ein neuer Fall steht am Ende, die vorhandenen bleiben vorn.
const mitNeuem = uebernimmFall(bestehend, 'd', { name: 'D' })
assert.deepEqual(Object.keys(mitNeuem.faelle), ['a', 'b', 'c', 'd'])
assert.equal(JSON.stringify(mitNeuem.faelle.b), JSON.stringify(bestehend.faelle.b))

// Optionen.
assert.deepEqual(leseOptionen([]), { nur: undefined, ziel: undefined })
assert.deepEqual(leseOptionen(['--nur', 'x']), { nur: 'x', ziel: undefined })
assert.deepEqual(leseOptionen(['--ziel', 'z.json', '--nur', 'x']), { nur: 'x', ziel: 'z.json' })
assert.throws(() => leseOptionen(['--nur']), /braucht einen Wert/)
assert.throws(() => leseOptionen(['--nur', '--ziel', 'z']), /braucht einen Wert/)
assert.throws(() => leseOptionen(['--alles']), /Unbekannte Option/)

// Prozess: unbekannter Fall bricht ab (Exit ≠ 0, Fall genannt) und lässt die Zieldatei unberührt.
const ordner = mkdtempSync(join(tmpdir(), 'buehne-nur-'))
try {
  const ziel = join(ordner, 'faelle.json')
  writeFileSync(ziel, `${vorher}\n`)
  let fehler
  try {
    execFileSync(process.execPath, [resolve(import.meta.dirname, 'buehne-faelle.mjs'), '--nur', 'gibt-es-nicht', '--ziel', ziel], { stdio: 'pipe', windowsHide: true })
  } catch (e) {
    fehler = e
  }
  assert.ok(fehler, 'unbekannter Fall muss scheitern')
  assert.match(String(fehler.stderr), /Unbekannter Fall gibt-es-nicht/)
  assert.equal(readFileSync(ziel, 'utf8'), `${vorher}\n`)
} finally {
  rmSync(ordner, { recursive: true, force: true })
}

console.log('buehne-faelle --nur: 6 Gruppen (Ersetzen, Reihenfolge, neuer Fall, Optionen, unbekannter Fall) ok')
