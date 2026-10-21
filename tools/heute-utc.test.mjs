/**
 * Gegenprobe zu tools/heute-utc.mjs: jede Form von „heute als UTC-Tag“ macht rot, ein gegebenes Datum, Strings und
 * Kommentare nicht; erfasst werden getrackte Code-Dateien in pipeline/, tools/, shared/, worker/, web/ (nicht extension/,
 * nicht untracked); die Grenze lässt an der Grenze durch, `--festschreiben` senkt und erhöht nie, und
 * tools/commit-data.sh schreibt sie auf main fest.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const tools = dirname(fileURLToPath(import.meta.url))
const werkzeug = join(tools, 'heute-utc.mjs')
const ordner = mkdtempSync(join(tmpdir(), 'heute-utc-'))

const lauf = (quelle, grenzen, ...optionen) => spawnSync(process.execPath, [werkzeug, '--quelle', quelle, '--grenzen', grenzen, ...optionen], { encoding: 'utf8', windowsHide: true })
const git = (wurzel, ...args) => spawnSync('git', ['-C', wurzel, ...args], { encoding: 'utf8', windowsHide: true })

function schreibe(wurzel, dateien) {
  for (const [pfad, text] of Object.entries(dateien)) {
    mkdirSync(dirname(join(wurzel, pfad)), { recursive: true })
    writeFileSync(join(wurzel, pfad), text)
  }
}

/** Git-Ordner: `dateien` getrackt, `ungetrackt` nur auf der Platte. */
function baum(name, dateien, ungetrackt = {}) {
  const wurzel = join(ordner, name)
  mkdirSync(wurzel, { recursive: true })
  assert.equal(git(wurzel, 'init', '-q').status, 0)
  schreibe(wurzel, dateien)
  assert.equal(git(wurzel, 'add', '-A').status, 0)
  schreibe(wurzel, ungetrackt)
  return wurzel
}

const grenzen = (n) => {
  const datei = join(ordner, `grenzen-${n}.json`)
  writeFileSync(datei, JSON.stringify({ erlaubt: n }))
  return datei
}

let zaehler = 0
/** Fundstellen einer einzelnen Quelltext-Zeile (Grenze 99, damit nur --liste zählt). */
const funde = (text, datei = 'pipeline/a.ts') => {
  const wurzel = baum(`f${zaehler++}`, { [datei]: text })
  const antwort = lauf(wurzel, grenzen(99), '--liste')
  assert.equal(antwort.status, 0, antwort.stderr)
  return antwort.stdout.split('\n').filter(Boolean)
}

try {
  // Jede Form von „heute in UTC“ zählt genau einmal, mit der richtigen Zeile.
  for (const form of [
    'new Date().toISOString().slice(0, 10)',
    'new Date().toISOString().slice(0,10)',
    'new Date( ).toISOString( ).slice( 0 , 10 )',
    'new Date().toISOString().substring(0, 10)',
    "new Date().toISOString().split('T')[0]",
    'new Date(Date.now()).toISOString().slice(0, 10)',
    'new Date()\n    .toISOString()\n    .slice(0, 10)',
    '(new Date()).toISOString().slice(0, 10)',
  ]) {
    assert.deepEqual(funde(`const x = 1\nconst t = ${form}\n`), ['pipeline/a.ts:2'], `zählt: ${JSON.stringify(form)}`)
  }
  assert.deepEqual(funde('const x = [new Date().toISOString().slice(0, 10), new Date().toISOString().slice(0, 10)]\n'), ['pipeline/a.ts:1', 'pipeline/a.ts:1'], 'zwei Vorkommen in einer Zeile')

  // Das zählt nicht: gegebenes Datum, anderer Schnitt, anderer Aufruf, Text.
  for (const form of [
    'new Date(x).toISOString().slice(0, 10)',
    "new Date('2026-10-12').toISOString().slice(0, 10)",
    'new Date(Date.now() - 864e5).toISOString().slice(0, 10)',
    'new Date(Date.now(), 1).toISOString().slice(0, 10)',
    'new Date(zeit.now()).toISOString().slice(0, 10)',
    'new Date(Date.parse(x)).toISOString().slice(0, 10)',
    'new Date().toLocaleString().slice(0, 10)',
    'new Date().toISOString().splice(0, 10)',
    "new Date(x).toISOString().split('T')[0]",
    "new Date().toISOString().teile('T')[0]",
    'new Date().toISOString().split(T)[0]',
    'x.split.y[0]',
    'liste[0]',
    'new Date().toISOString().slice(0, 7)',
    'new Date().toISOString().slice(1, 10)',
    'new Date().toISOString().slice(0)',
    'new Date().toISOString().slice(0, 10, 1)',
    'new Date().toISOString()',
    "new Date().toISOString().split('T')[1]",
    "new Date().toISOString().split('-')[0]",
    "new Date().toISOString().split('T')",
    'new Date().toISOString().replace("T", " ")',
    'jetzt.toISOString().slice(0, 10)',
    'neu.Date().toISOString().slice(0, 10)',
    'new Datum().toISOString().slice(0, 10)',
    "'new Date().toISOString().slice(0, 10)'",
    '`${1} new Date().toISOString().slice(0, 10)`',
    '/* new Date().toISOString().slice(0, 10) */ 1',
    'todayIso()',
  ]) {
    assert.deepEqual(funde(`const t = ${form}\n`), [], `zählt nicht: ${JSON.stringify(form)}`)
  }
  assert.deepEqual(funde('// new Date().toISOString().slice(0, 10)\nconst t = 1\n'), [], 'Zeilenkommentar')

  // Reichweite: getrackte Code-Dateien in den fünf Ordnern; nichts sonst.
  const zeile = 'const t = new Date().toISOString().slice(0, 10)\n'
  const wurzel = baum(
    'reichweite',
    {
      'pipeline/a.ts': zeile,
      'pipeline/b.mjs': zeile,
      'tools/c.mjs': zeile,
      'tools/d.test.ts': zeile,
      'shared/e.ts': zeile,
      'worker/src/f.ts': zeile,
      'web/src/g.tsx': zeile,
      'web/src/h.jsx': zeile,
      'tools/i.cjs': zeile,
      'pipeline/p.mts': zeile,
      'pipeline/q.cts': zeile,
      'pipeline/r.js': zeile,
      'extension/j.js': zeile,
      'docs/k.ts': zeile,
      'wurzel.ts': zeile,
      'tools/l.txt': zeile,
      'tools/m.json': zeile,
    },
    { 'pipeline/neu.ts': zeile, 'node_modules/x/n.js': zeile, '_wt-fremd/pipeline/o.ts': zeile },
  )
  const antwort = lauf(wurzel, grenzen(99), '--liste')
  assert.deepEqual(
    antwort.stdout.split('\n').filter(Boolean).sort(),
    ['pipeline/a.ts:1', 'pipeline/b.mjs:1', 'pipeline/p.mts:1', 'pipeline/q.cts:1', 'pipeline/r.js:1', 'shared/e.ts:1', 'tools/c.mjs:1', 'tools/d.test.ts:1', 'tools/i.cjs:1', 'web/src/g.tsx:1', 'web/src/h.jsx:1', 'worker/src/f.ts:1'],
    antwort.stderr,
  )

  // Grenze: an der Grenze grün, darunter grün, darüber rot, fehlendes Feld rot.
  const grund = { 'pipeline/a.ts': zeile, 'pipeline/b.ts': 'const t = 1\n' }
  const an = lauf(baum('grund', grund), grenzen(1))
  assert.equal(an.status, 0, 'genau an der Grenze grün')
  assert.match(an.stdout, /^Heute-UTC in Ordnung: 1 Vorkommen, höchstens 1 erlaubt\.$/m)
  assert.equal(lauf(baum('grund', grund), grenzen(2)).status, 0, 'unter der Grenze grün')
  const ueber = lauf(baum('grund', grund), grenzen(0))
  assert.equal(ueber.status, 1, 'ein Vorkommen über der Grenze rot')
  assert.match(ueber.stderr, /1 statt höchstens 0/)
  const kaputt = join(ordner, 'kaputt.json')
  writeFileSync(kaputt, '{}')
  assert.equal(lauf(baum('grund', grund), kaputt).status, 1, 'Grenzdatei ohne Zahl: rot statt stillschweigend 0')

  // --festschreiben senkt, erhöht nie.
  const datei = grenzen(5)
  assert.equal(lauf(baum('grund', grund), datei, '--festschreiben').status, 0)
  assert.equal(JSON.parse(readFileSync(datei, 'utf8')).erlaubt, 1, '--festschreiben senkt auf den Bestand')
  const hoch = baum('hoch', { 'pipeline/a.ts': zeile + zeile })
  assert.equal(lauf(hoch, datei, '--festschreiben').status, 1, '--festschreiben erhöht nie')
  assert.equal(JSON.parse(readFileSync(datei, 'utf8')).erlaubt, 1)
  const gleich = baum('gleich', { 'pipeline/a.ts': zeile })
  assert.equal(lauf(gleich, datei, '--festschreiben').status, 0, '--festschreiben auf gleichem Stand')
  assert.equal(JSON.parse(readFileSync(datei, 'utf8')).erlaubt, 1)

  // Der Wächter in tools/commit-data.sh (läuft auf main): Zeilenpaar „festschreiben → hinzu“.
  const zeilen = readFileSync(join(tools, 'commit-data.sh'), 'utf8').split('\n').map((z) => z.trim())
  const i = zeilen.indexOf('if node tools/heute-utc.mjs --festschreiben > /dev/null 2>&1; then')
  assert.ok(i >= 0, 'commit-data.sh ruft heute-utc.mjs --festschreiben auf')
  assert.equal(zeilen[i + 1], 'hinzu tools/heute-utc-grenzen.json', 'und stagt danach die Grenzdatei')

  // Das Tor: die Liste von check:logic ruft den Wächter auf.
  const liste = readFileSync(join(tools, 'check-logic-liste.txt'), 'utf8').split('\n')
  assert.ok(liste.includes('tools/heute-utc.mjs'), 'check-logic-liste.txt enthält den Wächter')

  // Der echte Bestand liegt in der Grenze.
  const echt = spawnSync(process.execPath, [werkzeug], { encoding: 'utf8', windowsHide: true })
  assert.equal(echt.status, 0, `der echte Bestand liegt in der Grenze: ${echt.stderr}`)
  assert.match(echt.stdout, /^Heute-UTC in Ordnung: \d+ Vorkommen, höchstens \d+ erlaubt\.$/m)
  console.log('Alle Prüfungen grün.')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
