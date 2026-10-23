/** Tests für tools/start-budget.mjs: Kulissen-`dist/` mit unkomprimierbaren Dateien (Zufallsbytes), damit die gzip-Größe feststeht. */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bewerte, GRENZE, messe, startDateien, startSchriften } from './start-budget.mjs'

// Je Gruppe drei Kandidaten, der geprüfte in der Mitte (Bundler legt mehrere Skripte, Vorab-Chunks und Stylesheets an).
const html = (teil = '["meta","woche"]') => `<html><head>
<link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/icons/apple.png" />
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="alternate" type="application/rss+xml" title="News" href="/data/feeds/news.xml" />
<link rel="canonical" href="https://beispiel.de/" />
<script type="module" crossorigin src="/assets/index-A.js"></script>
<script type="module" crossorigin src="/assets/index-B.js"></script>
<link rel="modulepreload" crossorigin href="/assets/vendor-C.js">
<link rel="modulepreload" crossorigin href="/assets/vendor-D.js">
<link rel="modulepreload" crossorigin href="/assets/vendor-E.js">
<link rel="stylesheet" crossorigin href="/assets/index-F.css">
<link rel="stylesheet" crossorigin href="/assets/index-G.css">
<link rel="stylesheet" crossorigin href="/assets/index-H.css">
<script>var voll = ["meta","titles-core"], teil = ${teil}, nimm = voll;</script></head></html>`
const MANROPE = 'assets/manrope-latin-wght-normal-X1.woff2'
const UNBOUNDED = 'assets/unbounded-700-de-X2.woff2'
const face = (datei) => `@font-face{font-family:F;src:url(/${datei}) format("woff2")}`
// Manrope im mittleren, Unbounded im letzten Stylesheet; Schriften, die nicht zum Start gehören, stehen daneben.
const cssF = face('assets/manrope-cyrillic-wght-normal-X0.woff2')
const cssG = `${face('assets/unbounded-latin-500-normal-X3.woff2')}${face(MANROPE)}`
const cssH = face(UNBOUNDED)

/** Kulisse mit je einer Zufallsdatei; auch Dateien, die NICHT zum Start gehören (müssen unbeachtet bleiben). */
function kulisse(groessen, indexHtml = html(), css = { F: cssF, G: cssG, H: cssH }, wurzel = mkdtempSync(join(tmpdir(), 'start-budget-'))) {
  const dist = join(wurzel, 'dist')
  mkdirSync(join(dist, 'assets'), { recursive: true })
  mkdirSync(join(dist, 'data'))
  writeFileSync(join(dist, 'index.html'), indexHtml)
  for (const [pfad, n] of Object.entries(groessen)) {
    const buchstabe = /index-([FGH])\.css$/.exec(pfad)?.[1]
    writeFileSync(join(dist, pfad), buchstabe ? Buffer.concat([Buffer.from(css[buchstabe]), randomBytes(n)]) : randomBytes(n))
  }
  return dist
}
const alle = {
  'assets/index-A.js': 1000,
  'assets/index-B.js': 1500,
  'assets/vendor-C.js': 2000,
  'assets/vendor-D.js': 2500,
  'assets/vendor-E.js': 3000,
  'assets/index-F.css': 3000,
  'assets/index-G.css': 3500,
  'assets/index-H.css': 4000,
  'data/meta.json': 4000,
  'data/woche.json': 5000,
  [MANROPE]: 10000,
  [UNBOUNDED]: 6000,
  'assets/manrope-cyrillic-wght-normal-X0.woff2': 7000, // nicht Teil des Starts
  'assets/unbounded-latin-500-normal-X3.woff2': 8000, // nicht Teil des Starts
  'data/titles-core.json': 400000, // volle Ansicht, nicht Teil des Wochenstarts
  'assets/Dialog-D.js': 400000, // dynamisch geladen
}
const lauf = (dist, cwd) => spawnSync(process.execPath, [join(import.meta.dirname, 'start-budget.mjs'), ...(cwd ? [] : [dist])], { encoding: 'utf8', cwd })
const aufraeumen = (dist) => rmSync(join(dist, '..'), { recursive: true, force: true })
const IMMER = ['index.html', 'assets/index-A.js', 'assets/index-B.js', 'assets/vendor-C.js', 'assets/vendor-D.js', 'assets/vendor-E.js', 'assets/index-F.css', 'assets/index-G.css', 'assets/index-H.css', 'data/meta.json', 'data/woche.json']

// Dateiauswahl: alle Skripte, alle Vorab-Chunks, alle Stylesheets, Wochendaten, index.html — Icons, Manifest, Feed, Canonical nicht.
const start = startDateien(html())
assert.deepEqual(start.dateien, IMMER)
assert.match(startDateien('<html></html>').fehler, /Einstiegsskript/)
assert.match(startDateien(html().replace(/<link rel="stylesheet"[^>]*>/g, '')).fehler, /Stylesheet/)
assert.match(startDateien(html().replace(/teil = \[[^\]]*\]/, '')).fehler, /Vorlade-Skript/)

// Schreibformen: Reihenfolge der Attribute, Anführungszeichen, klassisches Skript, Font-Preload — jede wird gezählt, keine fehlt still.
const form = (alt, neu, erwartet) => assert.deepEqual(startDateien(html().replace(alt, neu)).dateien, erwartet, neu)
form('<link rel="stylesheet" crossorigin href="/assets/index-G.css">', '<link href="/assets/index-G.css" rel="stylesheet">', IMMER)
form('<link rel="stylesheet" crossorigin href="/assets/index-G.css">', '<link rel=stylesheet href=/assets/index-G.css>', IMMER)
form('<link rel="modulepreload" crossorigin href="/assets/vendor-D.js">', '<link crossorigin href="/assets/vendor-D.js" rel="modulepreload">', IMMER)
form('<link rel="modulepreload" crossorigin href="/assets/vendor-D.js">', "<link rel='modulepreload' href='/assets/vendor-D.js'>", IMMER)
form('<script type="module" crossorigin src="/assets/index-B.js"></script>', '<script src="/assets/index-B.js" type="module"></script>', IMMER)
form('<script type="module" crossorigin src="/assets/index-B.js"></script>', '<script src="/assets/index-B.js"></script>', IMMER)
form('<link rel="modulepreload" crossorigin href="/assets/vendor-D.js">', '<link rel="preload" as="font" href="/assets/vendor-D.js">', IMMER)
form('<link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />', '<link rel="icon" href="/icons/icon.svg" type="image/svg+xml" /><script src="/assets/legacy.js"></script>', ['index.html', 'assets/legacy.js', ...IMMER.slice(1)])
form('<link rel="stylesheet" crossorigin href="/assets/index-G.css">', '<link rel="stylesheet" href="/assets/index-G.css?v=7">', IMMER)
form('<link rel="stylesheet" crossorigin href="/assets/index-G.css">', '<link REL="Stylesheet" href="/assets/index-G.css">', IMMER)
// Tag in Großbuchstaben (HTML ist so gültig) wird gelesen.
form('<script type="module" crossorigin src="/assets/index-B.js"></script>', '<SCRIPT TYPE="module" SRC="/assets/index-B.js"></SCRIPT>', IMMER)
form('<link rel="modulepreload" crossorigin href="/assets/vendor-D.js">', '<LINK REL="modulepreload" HREF="/assets/vendor-D.js">', IMMER)
// Alles, was weder gezählt noch ausgenommen ist, ergibt einen Fehler statt stillem Auslassen.
for (const fremd of ['<link rel="prefetch" href="/assets/x.js">', '<link rel="dns-prefetch" href="/x">', '<link href="/assets/x.js">', '<link rel="modulepreload">', '<script src="https://cdn.beispiel.de/x.js"></script>', '<link rel="stylesheet" href="//cdn.beispiel.de/x.css">']) {
  assert.ok(startDateien(html().replace('</head>', `${fremd}</head>`)).fehler, fremd)
}

// gzip-Messung: komprimierbare Datei, genauer gzip-9-Wert (Stufe 1: 47757, Standard: 47294, ungepackt: 228890).
let dist = kulisse({})
let zeilen = ''
for (let i = 0; i < 20000; i++) zeilen += `zeile ${i}\n`
writeFileSync(join(dist, 'assets', 'komprimierbar.js'), zeilen)
assert.deepEqual(messe(dist, ['assets/komprimierbar.js']).zeilen, [{ pfad: 'assets/komprimierbar.js', bytes: 47266 }])
aufraeumen(dist)

// Startschrift per Dateinamen-Anfang: eine Schrift, die den Namen nur enthält, ist nicht die Startschrift.
{
  const lookalike = face('assets/x-manrope-latin-wght-normal-Y.woff2') + face('assets/unbounded-700-de-Y.woff2').replace('unbounded', 'zunbounded')
  const d = kulisse({}, html(), { F: cssF, G: lookalike + cssG, H: cssH })
  writeFileSync(join(d, 'assets', 'index-F.css'), cssF)
  writeFileSync(join(d, 'assets', 'index-G.css'), lookalike + cssG)
  writeFileSync(join(d, 'assets', 'index-H.css'), cssH)
  assert.deepEqual(startSchriften(d, ['assets/index-F.css', 'assets/index-G.css', 'assets/index-H.css']), { pfade: [MANROPE, UNBOUNDED], fehlt: [] })
  aufraeumen(d)
}

// Unter der Grenze: Exit 0, Zeile mit Summe und Luft; die Summe zählt genau die Startdateien, Schriften roh als eigener Summand.
dist = kulisse(alle)
const { zeilen: gemessen } = messe(dist, start.dateien)
const codeBytes = gemessen.reduce((s, z) => s + z.bytes, 0)
assert.ok(codeBytes > 30000 && codeBytes < 31000, `Code und Daten ${codeBytes}`)
let r = lauf(dist)
assert.equal(r.status, 0)
assert.match(r.stdout, /^start-budget: 4\d\.\d KB gzip von 300[.]0 KB, 25\d\.\d KB Luft \(Code und Daten 29\.\d KB \+ Schriften 15\.6 KB\)$/m)
// Grenzwert: genau die Summe besteht, ein Byte weniger nicht.
const summe = codeBytes + 16000
assert.equal(bewerte(dist, summe).code, 0)
const knapp = bewerte(dist, summe - 1)
assert.equal(knapp.code, 1)
assert.match(knapp.text, /^start-budget: [\d.]+ KB gzip, 0\.0 KB über der Grenze/m)
// Ohne Argument misst der Lauf `dist` im aktuellen Ordner.
r = lauf(dist, join(dist, '..'))
assert.equal(r.status, 0)
assert.match(r.stdout, /^start-budget: 4\d\.\d KB gzip von 300[.]0 KB/m)
aufraeumen(dist)

// Über der Grenze: Exit 1, Aufschlüsselung mit jeder Startdatei und jeder Startschrift auf eigener Zeile.
dist = kulisse({ ...alle, 'data/woche.json': GRENZE + 5000 })
r = lauf(dist)
assert.equal(r.status, 1)
assert.match(r.stderr, /^start-budget: 3\d\d\.\d KB gzip, \d+\.\d KB über der Grenze von 300[.]0 KB \(Code und Daten/m)
for (const pfad of [...start.dateien, MANROPE, UNBOUNDED]) assert.match(r.stderr, new RegExp(`^ +[\\d.]+ KB  ${pfad.replace(/[.]/g, '\\.')}$`, 'm'))
assert.doesNotMatch(r.stderr, /titles-core|Dialog|cyrillic|latin-500/)
aufraeumen(dist)

// Eine Startschrift fehlt im CSS: Exit 1 mit Namen, nie stilles Bestehen.
for (const [name, css] of [['manrope-latin-wght', { F: cssF, G: cssG.replace(face(MANROPE), ''), H: cssH }], ['unbounded-700-de', { F: cssF, G: cssG, H: '' }]]) {
  dist = kulisse(alle, html(), css)
  r = lauf(dist)
  assert.equal(r.status, 1)
  assert.match(r.stderr, new RegExp(`^start-budget: Startschrift nicht im CSS: ${name}$`, 'm'))
  aufraeumen(dist)
}

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
dist = kulisse(alle, html().replace('href="/assets/vendor-D.js"', 'href="/assets/index-A.js"'))
const doppelt = startDateien(readFileSync(join(dist, 'index.html'), 'utf8'))
assert.equal(messe(dist, doppelt.dateien).zeilen.length, doppelt.dateien.length - 1)
aufraeumen(dist)

console.log('start-budget.test: ok')

// Verdrahtung: beide Bau-Skripte rufen den Wächter als eigenen Schritt auf, nach dem Web-Bau (vite build) und vor dem Dateibudget.
const skripte = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8')).scripts
for (const name of ['build', 'build:schlank']) {
  const schritte = skripte[name].replace(/node tools\/bau-eingaben\.mjs "([^"]*)"/, (_, innen) => innen).split(' && ')
  const i = schritte.indexOf('node tools/start-budget.mjs')
  assert.ok(i > schritte.indexOf('vite build'), `${name}: start-budget nach vite build`)
  assert.equal(schritte[i - 1], 'tsx pipeline/check-teilseiten.ts', `${name}: start-budget direkt nach check-teilseiten`)
  assert.equal(schritte[i + 1], 'tsx tools/dateibudget.ts', `${name}: start-budget direkt vor dateibudget`)
  assert.equal(schritte.filter((s) => s.includes('start-budget')).length, 1, `${name}: genau ein Aufruf`)
}
console.log('start-budget.test: Verdrahtung ok')
