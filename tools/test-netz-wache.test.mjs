/* Test des Wächters tools/test-netz-wache.mjs: Fälle für jede Absicherungsform, Ausnahmen und die Verdrahtung an einer Wegwerf-Wurzel. */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AUSNAHMEN, pruefe, untersuche } from './test-netz-wache.mjs'

const START = `const b = await chromium.launch(); const s = await b.newPage();\n`
const faelle = [
  ['Browser ohne Route', START, true, false],
  ['Catch-all **/*', `${START}await s.route('**/*', (r) => r.abort())`, true, true],
  ['Catch-all **', `${START}await s.route('**', (r) => r.abort())`, true, true],
  ['Regex ^https?', `${START}await s.route(/^https?:\\/\\//, (r) => r.abort())`, true, true],
  ['Regex .*', `${START}await s.route(/.*/, (r) => r.abort())`, true, true],
  ['Regex ^https?:\\/\\/.* mit Flag', `${START}await s.route(/^https?:\\/\\/.*/i, (r) => r.fulfill())`, true, true],
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
  ['Regex nur am Anfang passend', `${START}await s.route(/^https?:\\/\\/api\\.x\\//, (r) => r.abort())`, true, false],
  ['Regex ohne Bezug', `${START}await s.route(/foo/, (r) => r.abort())`, true, false],
  ['Handler nur continue', `${START}await s.route('**/*', (r) => r.continue())`, true, false],
  ['Handler fehlt', `${START}await s.route('**/*')`, true, false],
  ['Handler fulfill im Block', `${START}await s.route('**/*', async (r) => { await r.fulfill({ body: '{}' }) })`, true, true],
  ['Empfänger app', `${START}await app.route('**/*', (r) => r.abort())`, true, false],
  ['Empfänger this.page', `${START}await this.page.route('**/*', (r) => r.abort())`, true, true],
  ['Catch-all nur als zweites Argument', `${START}await s.route('https://bild.test/**', (r) => r.abort(), '**/*')`, true, false],
  ['Aufrufname anders', `${START}await s.routen('**/*', (r) => r.abort())`, true, false],
  ['Name ähnlich sperreNetz', `${START}await sperreNetzwerk(s)`, true, false],
  ['sperreNetz als Methode', `${START}await x.sperreNetz(s)`, true, false],
  ['eigener Handler sperrt', `${START}function antworte(r) { return r.fulfill() }\nawait s.route('**/*', antworte)`, true, true],
  ['eigener Handler lässt durch', `${START}function antworte(r) { return r.continue() }\nawait s.route('**/*', antworte)`, true, false],
  ['Handler über Hilfsfunktion', `${START}function dicht(r) { return r.abort() }\nawait s.route('**/*', (r) => dicht(r))`, true, true],
  ['Handler ruft nur Durchlasser', `${START}const offen = (r) => r.continue()\nawait s.route('**/*', (r) => offen(r))`, true, false],
  ['fremder Handler (importiert)', `${START}await s.route('**/*', antworte)`, true, true],
  ['Fabrik-Handler', `${START}await s.route('**/*', ausliefern(daten))`, true, true],
]
for (const [name, text, startet, abgesichert] of faelle) {
  const u = untersuche(text)
  assert.deepEqual(u, { startet, abgesichert }, name)
}
assert.ok(Object.keys(AUSNAHMEN).length > 0 && Object.values(AUSNAHMEN).every((g) => typeof g === 'string' && g.trim()), 'jede Ausnahme hat einen Grund')

const lauf = (wurzel) =>
  spawnSync(process.execPath, [join(import.meta.dirname, 'test-netz-wache.mjs'), '--wurzel', wurzel, '--ohne-ausnahmen'], {
    encoding: 'utf8',
    timeout: 60_000,
    windowsHide: true,
  })

const wurzel = mkdtempSync(join(tmpdir(), 'netz-wache-'))
try {
  for (const d of ['tools/archiv', 'pipeline', 'extension', 'web/src']) mkdirSync(join(wurzel, d), { recursive: true })
  writeFileSync(join(wurzel, 'tools', 'gut.mjs'), `${START}await s.route('**/*', f)`)
  writeFileSync(join(wurzel, 'tools', 'schlecht.mjs'), START)
  writeFileSync(join(wurzel, 'tools', 'archiv', 'alt.mjs'), START)
  writeFileSync(join(wurzel, 'pipeline', 'online.ts'), START)
  writeFileSync(join(wurzel, 'pipeline', 'ohne-browser.ts'), 'export const x = 1\n')
  writeFileSync(join(wurzel, 'extension', 'lader.cjs'), START)
  writeFileSync(join(wurzel, 'web', 'src', 'lade.tsx'), START)

  const e = pruefe(wurzel, { 'pipeline/online.ts': 'Sammler', 'tools/weg.mjs': 'gibt es nicht' })
  assert.deepEqual(e.verstoesse, ['tools/schlecht.mjs', 'extension/lader.cjs', 'web/src/lade.tsx'], 'alle vier Bereiche; Archiv zählt nicht')
  assert.equal(e.browser, 5)
  assert.equal(e.abgesichert, 1)
  assert.equal(e.ausgenommen, 1)
  assert.deepEqual(e.veraltet, ['tools/weg.mjs'], 'Ausnahme ohne Browserstart wird gemeldet')

  const rot = lauf(wurzel)
  assert.equal(rot.status, 1, 'Exit 1 bei Verstoß')
  assert.match(rot.stderr, /tools\/schlecht\.mjs: startet einen Browser ohne Catch-all-route/)
  assert.match(rot.stdout, /test-netz-wache: 5 Dateien mit Browser, 1 abgesichert, 0 Ausnahmen, 4 Verstöße/)

  for (const p of ['tools/schlecht.mjs', 'pipeline/online.ts', 'extension/lader.cjs', 'web/src/lade.tsx']) rmSync(join(wurzel, p))
  const gruen = lauf(wurzel)
  assert.equal(gruen.status, 0, `Exit 0 ohne Verstoß: ${gruen.stderr}`)
  assert.match(gruen.stdout, /1 Dateien mit Browser, 1 abgesichert, 0 Ausnahmen, 0 Verstöße/)

  rmSync(join(wurzel, 'tools', 'gut.mjs'))
  assert.equal(lauf(wurzel).status, 1, 'kein einziger Browser gefunden ist rot (Wächter blind)')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

const echt = spawnSync(process.execPath, [join(import.meta.dirname, 'test-netz-wache.mjs')], { encoding: 'utf8', timeout: 60_000, windowsHide: true })
assert.equal(echt.status, 0, `echtes Repo muss grün sein: ${echt.stderr}`)
console.log(`test-netz-wache.test: ${faelle.length} Formen, Archiv-/Ausnahme-/Leer-Fälle und Prozesslauf grün · ${echt.stdout.trim()}`)
