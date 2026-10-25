/**
 * Test zu `tools/kette-urteil.mjs`: Ergebnislisten und echter Prozess (Exit-Code und Ergebniszeile).
 * Aufruf: node tools/kette-urteil.test.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { kettenUrteil } from './kette-urteil.mjs'

const liste = (...r) => Object.fromEntries(r.map((result, i) => [`job${i}`, { result }]))

assert.equal(kettenUrteil(liste('success', 'success', 'success')), 'gruen')
assert.equal(kettenUrteil(liste('success')), 'gruen')
assert.equal(kettenUrteil(liste('cancelled', 'cancelled', 'cancelled')), 'abgebrochen')
assert.equal(kettenUrteil(liste('cancelled')), 'abgebrochen')
assert.equal(kettenUrteil(liste('failure', 'success', 'success')), 'rot')
assert.equal(kettenUrteil(liste('success', 'success', 'failure')), 'rot')
assert.equal(kettenUrteil(liste('failure', 'failure')), 'rot')
// Mix: ein Teiljob fehlt (Messung 25.10.2026: 1 von 15 abgebrochenen Läufen)
assert.equal(kettenUrteil(liste('success', 'cancelled', 'success')), 'rot')
assert.equal(kettenUrteil(liste('cancelled', 'success')), 'rot')
assert.equal(kettenUrteil(liste('cancelled', 'cancelled', 'failure')), 'rot')
assert.equal(kettenUrteil(liste('success', 'skipped')), 'rot')
assert.equal(kettenUrteil(liste('skipped', 'skipped')), 'rot')
assert.equal(kettenUrteil(liste('cancelled', 'skipped')), 'rot')
assert.equal(kettenUrteil({}), 'rot')
assert.equal(kettenUrteil(undefined), 'rot')
assert.equal(kettenUrteil({ a: {} }), 'rot')
assert.equal(kettenUrteil({ a: null }), 'rot')

const SKRIPT = resolve(import.meta.dirname, 'kette-urteil.mjs')
function lauf(needs) {
  const r = spawnSync(process.execPath, [SKRIPT], { env: { ...process.env, NEEDS: needs === undefined ? undefined : JSON.stringify(needs) }, encoding: 'utf8', windowsHide: true })
  return { code: r.status, aus: r.stdout }
}
const gruen = lauf(liste('success', 'success'))
assert.equal(gruen.code, 0)
assert.match(gruen.aus, /^kette-urteil: gruen$/m)
const abgebrochen = lauf(liste('cancelled', 'cancelled'))
assert.equal(abgebrochen.code, 0)
assert.match(abgebrochen.aus, /^kette-urteil: abgebrochen$/m)
assert.match(abgebrochen.aus, /^job0: cancelled$/m)
const rot = lauf(liste('success', 'failure'))
assert.equal(rot.code, 1)
assert.match(rot.aus, /^kette-urteil: rot$/m)
assert.equal(lauf(liste('success', 'cancelled')).code, 1)
assert.equal(lauf(undefined).code, 1, 'ohne NEEDS rot')

console.log('kette-urteil.test: 16 Listenfälle, 5 Prozessfälle ok')
