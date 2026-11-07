/* Test des Wächters tools/test-netz-wache.mjs: Fälle für jede Absicherungsform, Ausnahmen und die Verdrahtung an einer Wegwerf-Wurzel. */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pruefe, untersuche } from './test-netz-wache.mjs'

const START = `const b = await chromium.launch(); const s = await b.newPage();\n`
const faelle = [
  ['Browser ohne Route', START, true, false],
  ['Catch-all **/*', `${START}await s.route('**/*', (r) => r.abort())`, true, true],
  ['Catch-all **', `${START}await s.route('**', (r) => r.abort())`, true, true],
  ['Regex ^https?', `${START}await s.route(/^https?:\\/\\//, (r) => r.abort())`, true, true],
  ['Regex .*', `${START}await s.route(/.*/, (r) => r.abort())`, true, true],
  ['Helfer sperreNetz', `${START}await sperreNetz(s)`, true, true],
  ['nur eine Einzeladresse', `${START}await s.route('https://bild.test/**', (r) => r.abort())`, true, false],
  ['Teilpfad **/api/*', `${START}await s.route('**/api/*', (r) => r.abort())`, true, false],
  ['Route in Kommentar', `${START}// s.route('**/*', f)\n`, true, false],
  ['Route in Zeichenkette', `${START}const t = "s.route('**/*', f)"`, true, false],
  ['kein Browser, nur Wort im Text', `const t = 'chromium.launch()'`, false, false],
  ['nur launch', `await chromium.launch()`, true, false],
  ['nur launchPersistentContext', `await chromium.launchPersistentContext('x')`, true, false],
  ['nur newPage', `await browser.newPage()`, true, false],
  ['nur newContext', `await browser.newContext()`, true, false],
  ['Kontext statt Seite', `const c = await b.newContext(); await c.route('**/*', f)`, true, true],
]
for (const [name, text, startet, abgesichert] of faelle) {
  const u = untersuche(text)
  assert.deepEqual(u, { startet, abgesichert }, name)
}

const wurzel = mkdtempSync(join(tmpdir(), 'netz-wache-'))
try {
  mkdirSync(join(wurzel, 'tools'), { recursive: true })
  mkdirSync(join(wurzel, 'tools', 'archiv'), { recursive: true })
  mkdirSync(join(wurzel, 'pipeline'), { recursive: true })
  writeFileSync(join(wurzel, 'tools', 'gut.mjs'), `${START}await s.route('**/*', f)`)
  writeFileSync(join(wurzel, 'tools', 'schlecht.mjs'), START)
  writeFileSync(join(wurzel, 'tools', 'archiv', 'alt.mjs'), START)
  writeFileSync(join(wurzel, 'pipeline', 'online.ts'), START)
  writeFileSync(join(wurzel, 'pipeline', 'ohne-browser.ts'), 'export const x = 1\n')

  const e = pruefe(wurzel, { 'pipeline/online.ts': 'Sammler', 'tools/weg.mjs': 'gibt es nicht' })
  assert.deepEqual(e.verstoesse, ['tools/schlecht.mjs'], 'nur die ungesicherte Datei; Archiv zählt nicht')
  assert.equal(e.browser, 3)
  assert.equal(e.abgesichert, 1)
  assert.equal(e.ausgenommen, 1)
  assert.deepEqual(e.veraltet, ['tools/weg.mjs'], 'Ausnahme ohne Browserstart wird gemeldet')

  const lauf = spawnSync(process.execPath, [join(import.meta.dirname, 'test-netz-wache.mjs'), '--wurzel', wurzel, '--ohne-ausnahmen'], {
    encoding: 'utf8',
    timeout: 60_000,
    windowsHide: true,
  })
  assert.equal(lauf.status, 1, 'Exit 1 bei Verstoß')
  assert.match(lauf.stderr, /tools\/schlecht\.mjs: startet einen Browser ohne Catch-all-route/)
  assert.match(lauf.stdout, /test-netz-wache: 3 Dateien mit Browser, 1 abgesichert, 0 Ausnahmen, 2 Verstöße/)

  rmSync(join(wurzel, 'tools', 'schlecht.mjs'))
  rmSync(join(wurzel, 'pipeline', 'online.ts'))
  const gruen = spawnSync(process.execPath, [join(import.meta.dirname, 'test-netz-wache.mjs'), '--wurzel', wurzel, '--ohne-ausnahmen'], {
    encoding: 'utf8',
    timeout: 60_000,
    windowsHide: true,
  })
  assert.equal(gruen.status, 0, `Exit 0 ohne Verstoß: ${gruen.stderr}`)
  assert.match(gruen.stdout, /1 Dateien mit Browser, 1 abgesichert, 0 Ausnahmen, 0 Verstöße/)

  rmSync(join(wurzel, 'tools', 'gut.mjs'))
  const leer = spawnSync(process.execPath, [join(import.meta.dirname, 'test-netz-wache.mjs'), '--wurzel', wurzel, '--ohne-ausnahmen'], {
    encoding: 'utf8',
    timeout: 60_000,
    windowsHide: true,
  })
  assert.equal(leer.status, 1, 'kein einziger Browser gefunden ist rot (Wächter blind)')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

const echt = spawnSync(process.execPath, [join(import.meta.dirname, 'test-netz-wache.mjs')], { encoding: 'utf8', timeout: 60_000, windowsHide: true })
assert.equal(echt.status, 0, `echtes Repo muss grün sein: ${echt.stderr}`)
console.log(`test-netz-wache.test: ${faelle.length} Formen, Archiv-/Ausnahme-/Leer-Fälle und Prozesslauf grün · ${echt.stdout.trim()}`)
