import assert from 'node:assert/strict'
import { istErweitert } from './pruef-schaltung.mjs'

assert.equal(istErweitert('0', { erweitert: true }), false, '=0 schlägt die Regeldatei')
assert.equal(istErweitert('1', undefined), true, '=1 ohne Regeldatei')
assert.equal(istErweitert('1', { erweitert: false }), true, '=1 schlägt die Regeldatei')
assert.equal(istErweitert(undefined, { erweitert: true }), true, 'unbelegt: Datei an')
assert.equal(istErweitert('', { erweitert: true }), true, 'leer: Datei an')
assert.equal(istErweitert(undefined, { erweitert: false }), false, 'unbelegt: Datei aus')
assert.equal(istErweitert(undefined, undefined), false, 'unbelegt ohne Datei')
console.log('✓ pruef-schaltung: 7 Fälle')
