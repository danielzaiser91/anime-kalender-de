/**
 * Gegenprobe zu `tools/tests-alle.mjs`: Jeder Test dort läuft unter der Bestandssperre (`tools/bestand-sperre.cjs`).
 * Dieser Test liest `public/data` und muss abgelehnt werden; fehlt die Sperre im Lauf, ist er selbst rot.
 * Aufruf: `node tools/sperre-in-tests-alle.test.mjs` (ohne Sperre rot, nur über `tests-alle` oder mit `NODE_OPTIONS=--require tools/bestand-sperre.cjs`).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

assert.throws(() => readFileSync('public/data/titles.json'), /darf den gebauten Bestand nicht lesen/, 'tests-alle muss die Bestandssperre laden')
console.log('sperre-in-tests-alle.test: ok')
