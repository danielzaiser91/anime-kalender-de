// Ratsche „Kindprozess in Tests mit Frist“ (tools/test-kind-frist.mjs): Erkennung je Aufrufform, Vergleich mit dem Stand,
// und der echte Stand des Repos.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { aufrufeOhneFrist, summe, vergleiche, zaehle } from './test-kind-frist.mjs'

const ohne = (code) => aufrufeOhneFrist(code, 'x.mjs')

// 1. Jede Aufrufform ohne Frist zählt (Zeilennummer 2 = Aufruf).
const kopf = "import { spawnSync, execFileSync as efs, spawn, execSync, execFile, fork } from 'node:child_process'\n"
assert.deepEqual(ohne(`${kopf}spawnSync('a', [])`), [2])
assert.deepEqual(ohne(`${kopf}efs('a', [])`), [2], 'Alias')
assert.deepEqual(ohne(`${kopf}spawn('a', [], { cwd: 'x' })`), [2])
assert.deepEqual(ohne(`${kopf}execSync('a')`), [2])
assert.deepEqual(ohne(`${kopf}execFile('a', [])`), [2])
assert.deepEqual(ohne(`${kopf}fork('a')`), [2])
assert.deepEqual(ohne("import * as cp from 'node:child_process'\ncp.spawnSync('a', [])"), [2], 'Namensraum')
assert.deepEqual(ohne("import cp from 'child_process'\ncp.exec('a')"), [2], 'Default-Import, exec am Namensraum')
assert.deepEqual(ohne("const cp = require('node:child_process')\ncp.execSync('a')"), [2], 'require')
assert.deepEqual(ohne("const { execFileSync: e } = require('child_process')\ne('a', [])"), [2], 'require mit Umbenennung')
assert.deepEqual(ohne("require('child_process').spawnSync('a', [])"), [1], 'require am Aufruf')
assert.deepEqual(ohne(`${kopf}spawnSync('a', [], { ...opt })`), [2], 'Spread zeigt keine Frist')

// 2. Mit Frist zählt nicht; ebenso die Helfer, die sie selbst tragen.
assert.deepEqual(ohne(`${kopf}spawnSync('a', [], { cwd: 'x', timeout: 5000 })`), [])
assert.deepEqual(ohne(`${kopf}spawnSync('a', [], { timeout })`), [], 'Kurzschreibweise')
assert.deepEqual(ohne(`${kopf}efs('a', [], { limitMs: 5 })`), [])
assert.deepEqual(ohne("import { spawnMitLimit, mitLimit } from './kind-mit-limit.mjs'\nspawnMitLimit('a', [])\nmitLimit('a', [])"), [])

// 2b. Umgehungen zählen (Prüfer 2536 A1): jeder Verweis außer einem direkten Aufruf mit wirksamer Frist.
const cpKopf = "import cp from 'node:child_process'\n"
assert.deepEqual(ohne(`${cpKopf}const { spawnSync } = cp\nspawnSync('a')`), [3], 'Destrukturierung aus Default-Import')
assert.deepEqual(ohne("const { spawnSync } = await import('node:child_process')\nspawnSync('a')"), [2], 'await import')
assert.deepEqual(ohne("import { createRequire } from 'node:module'\nconst r = createRequire(import.meta.url)('node:child_process')\nr.spawnSync('a')"), [3], 'createRequire')
assert.deepEqual(ohne(`${kopf}const s = spawnSync\ns('a')`), [2], 'Alias auf den Namen')
assert.deepEqual(ohne(`${cpKopf}const e = cp.spawnSync\ne('a')`), [2], 'Alias auf die Eigenschaft')
assert.deepEqual(ohne(`${kopf}spawnSync.call(null, 'a', [])`), [2], '.call')
assert.deepEqual(ohne(`${cpKopf}cp['spawnSync']('a', [])`), [2], 'Eigenschaft in Klammern')
assert.deepEqual(ohne(`${cpKopf}const c2 = cp\nc2.spawnSync('a')`), [3], 'Alias des Namensraums')
assert.deepEqual(ohne(`${cpKopf}cp.spawnSync('a', [], { timeout: 5 })`), [], 'direkter Aufruf mit Frist bleibt frei')
assert.deepEqual(ohne(`${cpKopf}cp.execSync = (z) => z\ncp.execSync('a')`), [3], 'Zuweisung einer Attrappe ist kein Aufruf, der Aufruf danach schon')
// Eine aufgehobene Frist zählt als keine: 0, undefined, null; bei den Helfern limitMs 0.
assert.deepEqual(ohne(`${kopf}spawnSync('a', [], { timeout: 0 })`), [2])
assert.deepEqual(ohne(`${kopf}spawnSync('a', [], { timeout: undefined })`), [2])
assert.deepEqual(ohne(`${kopf}spawnSync('a', [], { timeout: null })`), [2])
assert.deepEqual(ohne("import { spawnMitLimit } from './kind-mit-limit.mjs'\nspawnMitLimit('a', [], {}, { limitMs: 0 })"), [2])
assert.deepEqual(ohne("import { mitLimit } from './kind-mit-limit.mjs'\nmitLimit('a', [], {}, { limitMs: 5000 })"), [], 'Helfer mit Frist')

// 3. Anderes zählt nicht: Regex-exec, eigene Funktionen gleichen Namens, nicht gebundene Namen.
assert.deepEqual(ohne('const m = /a/.exec(text)\nconst n = re.exec(text)'), [])
assert.deepEqual(ohne('function spawn() {}\nspawn()'), [])
assert.deepEqual(ohne("import { spawnSync } from './eigen.mjs'\nspawnSync('a')"), [], 'anderes Modul')
assert.deepEqual(ohne(`${kopf}spawnSync('a')\nspawnSync('b', [], { timeout: 1 })\nexecSync('c')`), [2, 4], 'mehrere, Zeilen')

// 4. Vergleich mit dem Stand: mehr = Fehler, weniger = Stand senken, gleich = ruhig, neue Datei beginnt bei 0.
assert.deepEqual(vergleiche({ 'tools/a.test.mjs': 2 }, { 'tools/a.test.mjs': 2 }), [])
assert.match(vergleiche({ 'tools/a.test.mjs': 3 }, { 'tools/a.test.mjs': 2 }).join('\n'), /tools\/a\.test\.mjs: 3 .* erlaubt 2/)
assert.match(vergleiche({ 'tools/a.test.mjs': 1 }, { 'tools/a.test.mjs': 2 }).join('\n'), /tools\/a\.test\.mjs: nur noch 1 .* auf 1 senken/)
assert.match(vergleiche({ 'tools/neu.test.mjs': 1 }, {}).join('\n'), /tools\/neu\.test\.mjs: 1 .* erlaubt 0/)
assert.match(vergleiche({}, { 'tools/weg.test.mjs': 2 }).join('\n'), /tools\/weg\.test\.mjs: nur noch 0/)
assert.equal(summe({ a: 2, b: 5 }), 7)

// 5. Zählung über einen Wegwerf-Ordner: erfasst Tests und Kulissen, nicht andere Dateien.
const wurzel = mkdtempSync(join(tmpdir(), 'kind-frist-'))
try {
  mkdirSync(join(wurzel, 'tools'))
  const code = "import { spawnSync } from 'node:child_process'\nspawnSync('a')\n"
  for (const name of ['a.test.mjs', 'b.test.ts', 'x-kulisse.mjs', 'y-mock.mjs', 'werkzeug.mjs']) writeFileSync(join(wurzel, 'tools', name), code)
  writeFileSync(join(wurzel, 'tools', 'leer.test.mjs'), 'export {}\n')
  assert.deepEqual(zaehle(wurzel), { 'tools/a.test.mjs': 1, 'tools/b.test.ts': 1, 'tools/x-kulisse.mjs': 1, 'tools/y-mock.mjs': 1 })
  // Der Prozess selbst (Prüfer 2536 A2): Verstoß -> Exit 1 mit ✖-Zeile; passender Stand -> Exit 0; zu hoher Stand -> Exit 1.
  const skript = fileURLToPath(new URL('./test-kind-frist.mjs', import.meta.url))
  const cli = (stand) => {
    const datei = join(wurzel, 'stand.json')
    writeFileSync(datei, JSON.stringify(stand))
    return spawnSync(process.execPath, [skript, '--wurzel', wurzel, '--stand', datei], { encoding: 'utf8', windowsHide: true, timeout: 120_000 })
  }
  const voll = { 'tools/a.test.mjs': 1, 'tools/b.test.ts': 1, 'tools/x-kulisse.mjs': 1, 'tools/y-mock.mjs': 1 }
  const gruen = cli(voll)
  assert.equal(gruen.status, 0, `${gruen.stdout}${gruen.stderr}`)
  assert.match(gruen.stdout, /^test-kind-frist: 4 Aufrufe ohne Frist in 4 Dateien, 0 Verstöße\.$/m)
  const rot = cli({ ...voll, 'tools/a.test.mjs': 0 })
  assert.equal(rot.status, 1)
  assert.match(rot.stderr, /^✖ tools\/a\.test\.mjs: 1 Kindprozess-Aufrufe ohne Frist, erlaubt 0/m)
  assert.match(rot.stdout, /1 Verstöße\./)
  assert.equal(cli({ ...voll, 'tools/a.test.mjs': 2 }).status, 1, 'Stand zu hoch: senken verlangt')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

// 6. Der echte Stand: Prozess wie in der Kette, Ergebniszeile mit Zählern.
const lauf = spawnSync(process.execPath, [fileURLToPath(new URL('./test-kind-frist.mjs', import.meta.url))], { encoding: 'utf8', windowsHide: true, timeout: 120_000 })
assert.equal(lauf.status, 0, `${lauf.stdout}${lauf.stderr}`)
assert.match(lauf.stdout, /^test-kind-frist: \d+ Aufrufe ohne Frist in \d+ Dateien, 0 Verstöße\.$/m)
console.log(lauf.stdout.trim())
console.log('test-kind-frist: ok (Aufrufformen, Helfer, Fremdes, Vergleich, Wegwerf-Ordner, echter Stand)')
