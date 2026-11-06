// Ratsche „gh-Aufruf in Werkzeugen mit Frist“ (tools/gh-kind-frist.mjs): Erkennung, Vergleich, Prozess, echter Stand.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ghAufrufeOhneFrist, summe, vergleiche, zaehle } from './gh-kind-frist.mjs'

const ohne = (code) => ghAufrufeOhneFrist(code, 'x.mjs')
const kopf = "import { spawnSync, execFileSync, execSync } from 'node:child_process'\nimport { mitLimit, spawnMitLimit } from './kind-mit-limit.mjs'\n"

// 1. Aufrufe ohne Frist zählen (Zeile 3 = Aufruf).
assert.deepEqual(ohne(`${kopf}execFileSync('gh', ['pr', 'list'])`), [3])
assert.deepEqual(ohne(`${kopf}spawnSync('gh', ['api', 'x'], { encoding: 'utf8' })`), [3])
assert.deepEqual(ohne(`${kopf}execFileSync(process.env.GH_BIN || 'gh', args)`), [3], 'Umgebungsvariable')
assert.deepEqual(ohne(`${kopf}execFileSync(GH, args)`), [3], 'Konstante GH')
assert.deepEqual(ohne(`${kopf}execFileSync(ghBefehl, args)`), [3], 'ghBefehl')
assert.deepEqual(ohne(`${kopf}ausfuehren('gh', ['api', pfad])`), [3], 'Wrapper mit gh als erstem Argument')
assert.deepEqual(ohne(`${kopf}function f(programm = ['gh']) {\n  return spawnSync(programm[0], args)\n}`), [4], 'programm[0] in Funktion mit gh')
assert.deepEqual(ohne(`${kopf}spawnSync('gh', ['a'], { timeout: 0 })`), [3], 'Frist 0 ist keine')
assert.deepEqual(ohne(`${kopf}spawnSync('gh', ['a'], { timeout: undefined })`), [3])
assert.deepEqual(ohne(`${kopf}mitLimit('gh', ['a'], {}, { limitMs: 0 })`), [3], 'Helfer mit aufgehobener Frist')

// 2. Mit Frist, über Helfer, oder kein gh: zählt nicht.
assert.deepEqual(ohne(`${kopf}spawnSync('gh', ['a'], { timeout: 5000 })`), [])
assert.deepEqual(ohne(`${kopf}execFileSync('gh', ['a'], { encoding: 'utf8', timeout })`), [])
assert.deepEqual(ohne(`${kopf}execFileSync('gh', ['a'], { limitMs: 9 })`), [])
assert.deepEqual(ohne(`${kopf}mitLimit('gh', ['a'], { encoding: 'utf8' })`), [])
assert.deepEqual(ohne(`${kopf}spawnMitLimit('gh', ['a'])`), [])
assert.deepEqual(ohne(`${kopf}execFileSync('git', ['status'])`), [], 'git')
assert.deepEqual(ohne(`${kopf}function f() {\n  return spawnSync('git', ['diff'])\n}\nconst g = ['gh']`), [], 'git in Funktion ohne gh')
assert.deepEqual(ohne(`${kopf}if (liste.includes('gh', 1)) {}\ntext.replace('gh', 'x')`), [], 'Zeichenkette gh als Suchwort')
assert.deepEqual(ohne(`${kopf}const m = /gh/.exec(text)`), [])
assert.deepEqual(ohne(`${kopf}execFileSync('gh')`), [], 'gh allein ohne Argumentliste (kein Aufruf-Muster)')
assert.deepEqual(ohne(`${kopf}spawnSync('gh', ['a'])\nspawnSync('gh', ['b'], { timeout: 1 })\nexecFileSync('gh', ['c'])`), [3, 5], 'mehrere')

// 3. Vergleich mit dem Stand.
assert.deepEqual(vergleiche({ 'tools/a.mjs': 2 }, { 'tools/a.mjs': 2 }), [])
assert.match(vergleiche({ 'tools/a.mjs': 3 }, { 'tools/a.mjs': 2 }).join('\n'), /tools\/a\.mjs: 3 gh-Aufrufe ohne Frist, erlaubt 2/)
assert.match(vergleiche({ 'tools/a.mjs': 1 }, { 'tools/a.mjs': 2 }).join('\n'), /tools\/a\.mjs: nur noch 1 .* auf 1 senken/)
assert.match(vergleiche({ 'tools/neu.mjs': 1 }, {}).join('\n'), /tools\/neu\.mjs: 1 .* erlaubt 0/)
assert.match(vergleiche({}, { 'tools/weg.mjs': 2 }).join('\n'), /tools\/weg\.mjs: nur noch 0/)
assert.equal(summe({ a: 2, b: 5 }), 7)

// 4. Wegwerf-Ordner und Prozess: erfasst Werkzeuge, keine Tests; Verstoß -> Exit 1.
const wurzel = mkdtempSync(join(tmpdir(), 'gh-frist-'))
try {
  mkdirSync(join(wurzel, 'tools'))
  const code = "import { execFileSync } from 'node:child_process'\nexecFileSync('gh', ['a'])\n"
  for (const name of ['a.mjs', 'b.cjs', 'c.test.mjs', 'd.json']) writeFileSync(join(wurzel, 'tools', name), code)
  assert.deepEqual(zaehle(wurzel).stand, { 'tools/a.mjs': 1, 'tools/b.cjs': 1 })
  const skript = fileURLToPath(new URL('./gh-kind-frist.mjs', import.meta.url))
  const cli = (stand) => {
    const datei = join(wurzel, 'stand.json')
    writeFileSync(datei, JSON.stringify(stand))
    return spawnSync(process.execPath, [skript, '--wurzel', wurzel, '--stand', datei], { encoding: 'utf8', windowsHide: true, timeout: 120_000 })
  }
  const gruen = cli({ 'tools/a.mjs': 1, 'tools/b.cjs': 1 })
  assert.equal(gruen.status, 0, `${gruen.stdout}${gruen.stderr}`)
  assert.match(gruen.stdout, /^gh-kind-frist: 2 gh-Aufrufe ohne Frist in 2 Dateien, 0 Verstöße\.$/m)
  const rot = cli({ 'tools/a.mjs': 0, 'tools/b.cjs': 1 })
  assert.equal(rot.status, 1)
  assert.match(rot.stderr, /^✖ tools\/a\.mjs: 1 gh-Aufrufe ohne Frist, erlaubt 0/m)
  assert.equal(cli({ 'tools/a.mjs': 2, 'tools/b.cjs': 1 }).status, 1, 'Stand zu hoch: senken verlangt')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

// 5. Der echte Stand wie in der Kette.
const lauf = spawnSync(process.execPath, [fileURLToPath(new URL('./gh-kind-frist.mjs', import.meta.url))], { encoding: 'utf8', windowsHide: true, timeout: 120_000 })
assert.equal(lauf.status, 0, `${lauf.stdout}${lauf.stderr}`)
assert.match(lauf.stdout, /^gh-kind-frist: \d+ gh-Aufrufe ohne Frist in \d+ Dateien, 0 Verstöße\.$/m)
console.log(lauf.stdout.trim())
console.log('gh-kind-frist: ok (Aufrufformen, Fristen, Fremdes, Vergleich, Wegwerf-Ordner, echter Stand)')
