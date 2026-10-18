/** Tests für tools/start-budget.mjs: Kulissen-`dist/` mit unkomprimierbaren Dateien (Zufallsbytes), damit die gzip-Größe feststeht. */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bewerte, GRENZE, messe, startDateien } from './start-budget.mjs'

const html = (teil = '["meta","woche"]') => `<html><head>
<script type="module" crossorigin src="/assets/index-A.js"></script>
<link rel="modulepreload" crossorigin href="/assets/vendor-B.js">
<link rel="stylesheet" crossorigin href="/assets/index-C.css">
<script>var voll = ["meta","titles-core"], teil = ${teil}, nimm = voll;</script></head></html>`

/** Kulisse mit je einer Zufallsdatei; auch Dateien, die NICHT zum Start gehören (müssen unbeachtet bleiben). */
function kulisse(groessen, indexHtml = html()) {
  const dist = mkdtempSync(join(tmpdir(), 'start-budget-'))
  mkdirSync(join(dist, 'assets'))
  mkdirSync(join(dist, 'data'))
  writeFileSync(join(dist, 'index.html'), indexHtml)
  for (const [pfad, n] of Object.entries(groessen)) writeFileSync(join(dist, pfad), randomBytes(n))
  return dist
}
const alle = {
  'assets/index-A.js': 1000,
  'assets/vendor-B.js': 2000,
  'assets/index-C.css': 3000,
  'data/meta.json': 4000,
  'data/woche.json': 5000,
  'data/titles-core.json': 400000, // volle Ansicht, nicht Teil des Wochenstarts
  'assets/Dialog-D.js': 400000, // dynamisch geladen
}
const lauf = (dist) => spawnSync(process.execPath, [join(import.meta.dirname, 'start-budget.mjs'), dist], { encoding: 'utf8' })
const aufraeumen = (dist) => rmSync(dist, { recursive: true, force: true })

// Dateiauswahl: Skript, Vorab-Chunk, Stylesheet, Wochendaten, index.html — sonst nichts.
const start = startDateien(html())
assert.deepEqual(start.dateien, ['index.html', 'assets/index-A.js', 'assets/vendor-B.js', 'assets/index-C.css', 'data/meta.json', 'data/woche.json'])
assert.match(startDateien('<html></html>').fehler, /Einstiegsskript/)
assert.match(startDateien(html().replace(/<link rel="stylesheet"[^>]*>/, '')).fehler, /Stylesheet/)
assert.match(startDateien(html().replace(/teil = \[[^\]]*\]/, '')).fehler, /Vorlade-Skript/)

// Unter der Grenze: Exit 0, Zeile mit Summe und Luft; die Summe zählt genau die Startdateien.
let dist = kulisse(alle)
const { zeilen } = messe(dist, start.dateien)
const summe = zeilen.reduce((s, z) => s + z.bytes, 0)
assert.ok(summe > 15000 && summe < 16000, `Summe ${summe}`)
let r = lauf(dist)
assert.equal(r.status, 0)
assert.match(r.stdout, /^start-budget: 15\.\d KB gzip von 300\.0 KB, 28\d\.\d KB Luft$/m)
// Grenzwert: genau die Summe besteht, ein Byte weniger nicht.
assert.equal(bewerte(dist, summe).code, 0)
const knapp = bewerte(dist, summe - 1)
assert.equal(knapp.code, 1)
assert.match(knapp.text, /^start-budget: [\d.]+ KB gzip, 0\.0 KB über der Grenze/m)
aufraeumen(dist)

// Über der Grenze: Exit 1, Aufschlüsselung mit jeder Startdatei auf eigener Zeile.
dist = kulisse({ ...alle, 'data/woche.json': GRENZE + 5000 })
r = lauf(dist)
assert.equal(r.status, 1)
assert.match(r.stderr, /^start-budget: 3\d\d\.\d KB gzip, \d+\.\d KB über der Grenze von 300\.0 KB$/m)
for (const pfad of start.dateien) assert.match(r.stderr, new RegExp(`^ +[\\d.]+ KB  ${pfad.replace(/[.]/g, '\\.')}$`, 'm'))
assert.doesNotMatch(r.stderr, /titles-core|Dialog/)
aufraeumen(dist)

// Fehlende Datei, fehlendes index.html, fehlender Ordner: Exit 1, nie stilles Bestehen.
const ohne = { ...alle }
delete ohne['data/woche.json']
dist = kulisse(ohne)
r = lauf(dist)
assert.equal(r.status, 1)
assert.match(r.stderr, /^start-budget: Datei fehlt in .*: data\/woche\.json$/m)
aufraeumen(dist)
r = lauf(join(tmpdir(), 'start-budget-gibt-es-nicht'))
assert.equal(r.status, 1)
assert.match(r.stderr, /^start-budget: .*index\.html fehlt \(erst bauen\)$/m)
dist = kulisse(alle, '<html></html>')
assert.equal(lauf(dist).status, 1)
aufraeumen(dist)

// Dieselbe Datei als Einstieg und als Vorab-Chunk (Vite listet beides) zählt einmal.
dist = kulisse(alle, html().replace('href="/assets/vendor-B.js"', 'href="/assets/index-A.js"'))
r = lauf(dist)
assert.match(r.stdout, /^start-budget: 1[0-3]\.\d KB gzip/m)
aufraeumen(dist)

console.log('start-budget.test: ok')

// Verdrahtung: beide Bau-Skripte rufen den Wächter als eigenen Schritt auf, nach dem Web-Bau (vite build) und vor dem Dateibudget.
const skripte = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8')).scripts
for (const name of ['build', 'build:schlank']) {
  const schritte = skripte[name].split(' && ')
  const i = schritte.indexOf('node tools/start-budget.mjs')
  assert.ok(i > schritte.indexOf('vite build'), `${name}: start-budget nach vite build`)
  assert.equal(schritte[i - 1], 'tsx pipeline/check-teilseiten.ts', `${name}: start-budget direkt nach check-teilseiten`)
  assert.equal(schritte[i + 1], 'tsx tools/dateibudget.ts', `${name}: start-budget direkt vor dateibudget`)
  assert.equal(schritte.filter((s) => s.includes('start-budget')).length, 1, `${name}: genau ein Aufruf`)
}
console.log('start-budget.test: Verdrahtung ok')
