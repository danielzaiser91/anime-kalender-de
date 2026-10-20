/** Test des Wächters `start-pruefung-wacht.mjs`: findet das Muster in der Mitte, auch mit Leerraum, lässt die richtige Form durch; als eigener Prozess: Exit-Code und Ergebniszeile. */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { findeFehlstarts } from './start-pruefung-wacht.mjs'

const falsch = 'if (import.meta.url === `' + 'file:///' + '${process.argv[1].replace(/a/g, "b")}`) await main()'
const falschLeer = 'x = `' + 'file:///' + '${ process.argv[1] }`'
const falschPlus = "if (import.meta.url === '" + 'file:///' + "' + process.argv[1]) await main()"
const falschPlusDoppelt = 'const u = "' + 'file:///' + '"+process.argv[1]'
assert.deepEqual(findeFehlstarts({ 'p.mjs': falschPlus, 'q.mjs': falschPlusDoppelt }), ['p.mjs', 'q.mjs'], 'Verkettung mit + wird erkannt')
const richtig = 'if (import.meta.url === pathToFileURL(process.argv[1]).href) await main()'
const andere = 'const u = `file:///${wurzel}/x`'

const texte = { 'a.mjs': richtig, 'b.mjs': falsch, 'c.mjs': andere, 'd.mjs': falschLeer, 'e.mjs': richtig }
assert.deepEqual(findeFehlstarts(texte), ['b.mjs', 'd.mjs'])
assert.deepEqual(findeFehlstarts({ 'a.mjs': richtig, 'c.mjs': andere }), [])
assert.deepEqual(findeFehlstarts({ 'z.mjs': falsch, 'a.mjs': richtig }), ['z.mjs'], 'Treffer an erster Stelle')
assert.deepEqual(findeFehlstarts({ 'a.mjs': richtig, 'y.mjs': falsch }), ['y.mjs'], 'Treffer an letzter Stelle')

const WAECHTER = path.join(import.meta.dirname, 'start-pruefung-wacht.mjs')

/** Startet den Wächter als eigenen Prozess gegen ein Wegwerf-Repo mit den versionierten `dateien` (Name → Inhalt). */
function lauf(dateien) {
  const wurzel = mkdtempSync(path.join(os.tmpdir(), 'start-wacht-'))
  try {
    spawnSync('git', ['init', '-q'], { cwd: wurzel })
    for (const [name, inhalt] of Object.entries(dateien)) {
      mkdirSync(path.dirname(path.join(wurzel, name)), { recursive: true })
      writeFileSync(path.join(wurzel, name), inhalt)
    }
    spawnSync('git', ['add', '-A'], { cwd: wurzel })
    return spawnSync(process.execPath, [WAECHTER, wurzel], { encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } })
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
}

const gut = lauf({ 'a.mjs': richtig, 'sub/b.ts': richtig, 'c.mjs': andere })
assert.equal(gut.status, 0, `gesundes Repo: Exit 0 (${gut.stderr})`)
assert.match(gut.stdout, /Startprüfung: 3 Dateien geprüft, 0 mit selbstgebautem file:\/\/\/-Vergleich\./, 'Ergebniszeile bei Erfolg')

// Der Fehlstart steht in der Mitte von drei Dateien; die Endung .tsx gehört zur Dateiliste.
const schlecht = lauf({ 'a.mjs': richtig, 'mitte/b.mjs': falsch, 'c.mjs': richtig })
assert.equal(schlecht.status, 1, 'Fehlstart: Exit 1')
assert.match(schlecht.stdout, /3 Dateien geprüft, 1 mit/, 'Ergebniszeile bei Fehlstart')
assert.match(schlecht.stderr, /mitte\/b\.mjs/, 'Fehlstart wird benannt')
assert.doesNotMatch(schlecht.stderr, /a\.mjs|c\.mjs/, 'gesunde Dateien werden nicht benannt')

const tsx = lauf({ 'a.mjs': richtig, 'web/x.tsx': falsch, 'c.mjs': richtig })
assert.equal(tsx.status, 1, 'Fehlstart in .tsx: Exit 1')
assert.match(tsx.stderr, /web\/x\.tsx/, '.tsx wird geprüft')
console.log('start-pruefung-wacht.test: ok')
