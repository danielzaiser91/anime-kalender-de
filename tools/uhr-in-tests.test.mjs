/**
 * Gegenprobe zu tools/uhr-in-tests.mjs: jede Form der echten Uhr macht rot (auch ohne Klammern und Leerzeichen),
 * Strings, Kommentare, Datum mit Argument und Zuweisung zählen nicht, `uhr-echt:` gilt nur als Kommentar mit Grund,
 * erfasst werden getrackte `*.test.*` und die Liste von check:logic (nicht untracked, nicht node_modules), `--festschreiben`
 * senkt und erhöht nie, und tools/commit-data.sh schreibt die Grenze auf main fest.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const tools = dirname(fileURLToPath(import.meta.url))
const werkzeug = join(tools, 'uhr-in-tests.mjs')
const ordner = mkdtempSync(join(tmpdir(), 'uhr-in-tests-'))

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
/** Anzahl der Fundstellen einer einzelnen Quelltext-Zeile (Grenze 99, damit nur --liste zählt). */
const funde = (text, datei = 'a.test.ts') => {
  const wurzel = baum(`f${zaehler++}`, { [datei]: text })
  const antwort = lauf(wurzel, grenzen(99), '--liste')
  assert.equal(antwort.status, 0, antwort.stderr)
  return antwort.stdout.split('\n').filter(Boolean)
}

try {
  // Jede Form der echten Uhr zählt genau einmal, mit der richtigen Zeile.
  for (const form of [
    'new Date()',
    'new Date( )',
    'new Date',
    'new Date(\n)',
    'Date.now()',
    'Date.now ()',
    'Date.now',
    'Date["now"]()',
    'new globalThis.Date()',
    'globalThis.Date.now()',
    'Date()',
  ]) {
    assert.deepEqual(funde(`const x = 1\nconst t = ${form}\n`), ['a.test.ts:2'], `zählt: ${JSON.stringify(form)}`)
  }
  assert.deepEqual(funde('const echteUhr = Date.now\nconst t = echteUhr()\n'), ['a.test.ts:1'], 'Verweis auf Date.now ohne Aufruf zählt (die Aufrufstelle selbst nicht)')
  assert.deepEqual(funde('const x = [Date.now(), new Date()]\n'), ['a.test.ts:1', 'a.test.ts:1'], 'zwei Vorkommen in einer Zeile zählen zweimal')

  assert.deepEqual(funde('const x = <b>{Date.now()}</b>\n', 'a.test.tsx'), ['a.test.tsx:1'], 'JSX in .tsx')
  assert.deepEqual(funde('const x = <b>{Date.now()}</b>\n', 'a.test.jsx'), ['a.test.jsx:1'], 'JSX in .jsx')
  assert.deepEqual(funde('function f<T>(x: T) { return Date.now() }\n', 'a.test.mts'), ['a.test.mts:1'], 'TypeScript in .mts')

  // Das zählt nicht.
  for (const form of [
    "new Date('2026-10-12T12:00:00Z')",
    'new Date(2026, 9, 12)',
    'new Date(ms)',
    'Date.UTC(2026, 9, 12)',
    'Date.parse("2026-10-12")',
    "'new Date()'",
    '`${1} Date.now()`',
    '/* new Date() */ 1',
    '// new Date()',
    'Date.now = () => 1',
    'globalThis.Date = Echt',
    'const Date2 = 1; Date2.now()',
    'neu.Date()',
    'zeit.now()',
  ]) {
    assert.deepEqual(funde(`const t = ${form}\n`), [], `zählt nicht: ${JSON.stringify(form)}`)
  }

  // Ausnahme nur als Kommentar mit Grund.
  assert.deepEqual(funde('const t = Date.now() // uhr-echt: misst die Wartezeit\n'), [], 'Kommentar mit Grund am Zeilenende')
  assert.deepEqual(funde('const t = new Date() /* uhr-echt: Alter einer Datei */\n'), [], 'Blockkommentar mit Grund')
  assert.deepEqual(funde('try {\n  go(Date.now()) // uhr-echt: letzte Anweisung im Block\n} finally {}\n'), [], 'Kommentar hinter der letzten Anweisung eines Blocks')
  assert.deepEqual(funde('const t = Date.now() // uhr-echt:\n'), ['a.test.ts:1'], 'ohne Grund zählt die Stelle')
  assert.deepEqual(funde('const t = Date.now() // uhr-echt:   \n'), ['a.test.ts:1'], 'Leerzeichen sind kein Grund')
  assert.deepEqual(funde('const t = /* uhr-echt: Grund */ Date.now()\n'), [], 'Blockkommentar vor der Stelle')
  assert.deepEqual(funde('const t = /* uhr-echt: Grund\n weiter */ Date.now()\n'), [], 'Blockkommentar über zwei Zeilen, Stelle in der letzten')
  assert.deepEqual(funde('const t = Date.now() /* uhr-echt: Grund\n weiter */\n'), [], 'Blockkommentar über zwei Zeilen, Stelle in der ersten')
  assert.deepEqual(funde('const t =\n  Date.now()\n'), ['a.test.ts:2'], 'gezählt wird die Zeile, in der die Stelle beginnt')
  assert.deepEqual(funde('const t = Date.now() /* uhr-echt: */\n'), ['a.test.ts:1'], 'leerer Blockkommentar')
  assert.deepEqual(funde('const t = [Date.now(), "uhr-echt: Grund"]\n'), ['a.test.ts:1'], 'im String gilt es nicht')
  assert.deepEqual(funde('const t = Date.now(), s = `uhr-echt: Grund`\n'), ['a.test.ts:1'], 'im Template gilt es nicht')
  assert.deepEqual(funde('// uhr-echt: Grund\nconst t = Date.now()\n'), ['a.test.ts:2'], 'Kommentar in der Zeile davor befreit nicht')

  // Reichweite: getrackte Testnamen aller Endungen und die Liste von check:logic; sonst nichts.
  const liste = 'const t = Date.now()\n'
  const wurzel = baum(
    'reichweite',
    {
      'a.test.ts': liste,
      'b.test.mts': liste,
      'c.test.js': liste,
      'd.test.tsx': liste,
      'e.test.cts': liste,
      'f.test.jsx': liste,
      'g.test.cjs': liste,
      'h.test.mjs': liste,
      'pipeline/check-x.ts': liste,
      'pipeline/check-nicht-in-liste.ts': liste,
      'tools/check-logic-liste.txt': '# Kommentar\n\npipeline/check-x.ts\npipeline/gibt-es-nicht.ts\n',
    },
    { 'neu.test.ts': liste, 'node_modules/x/e.test.ts': liste, '_wt-fremd/f.test.ts': liste, '.claude/worktrees/w/g.test.ts': liste },
  )
  const antwort = lauf(wurzel, grenzen(99), '--liste')
  assert.deepEqual(antwort.stdout.split('\n').filter(Boolean).sort(), ['a.test.ts:1', 'b.test.mts:1', 'c.test.js:1', 'd.test.tsx:1', 'e.test.cts:1', 'f.test.jsx:1', 'g.test.cjs:1', 'h.test.mjs:1', 'pipeline/check-x.ts:1'], antwort.stderr)

  // Grenze: an der Grenze grün, darunter grün, darüber rot, fehlendes Feld rot.
  const grund = { 'a.test.ts': 'const t = Date.now()\n', 'b.test.mjs': 'const t = 1\n' }
  assert.equal(lauf(baum('grund', grund), grenzen(1)).status, 0, 'genau an der Grenze grün')
  assert.equal(lauf(baum('grund', grund), grenzen(2)).status, 0, 'unter der Grenze grün')
  assert.equal(lauf(baum('grund', grund), grenzen(0)).status, 1, 'ein Vorkommen über der Grenze rot')
  const kaputt = join(ordner, 'kaputt.json')
  writeFileSync(kaputt, '{}')
  assert.equal(lauf(baum('grund', grund), kaputt).status, 1, 'Grenzdatei ohne Zahl: rot statt stillschweigend 0')

  // --festschreiben senkt, erhöht nie.
  const datei = grenzen(5)
  assert.equal(lauf(baum('grund', grund), datei, '--festschreiben').status, 0)
  assert.equal(JSON.parse(readFileSync(datei, 'utf8')).erlaubt, 1, '--festschreiben senkt auf den Bestand')
  const hoch = baum('hoch', { 'a.test.ts': 'Date.now()\nDate.now()\n' })
  assert.equal(lauf(hoch, datei, '--festschreiben').status, 1, '--festschreiben erhöht nie')
  assert.equal(JSON.parse(readFileSync(datei, 'utf8')).erlaubt, 1)

  // Der Wächter in tools/commit-data.sh (läuft auf main): Zeilenpaar „festschreiben → hinzu“.
  const zeilen = readFileSync(join(tools, 'commit-data.sh'), 'utf8').split('\n').map((z) => z.trim())
  const i = zeilen.indexOf('if node tools/uhr-in-tests.mjs --festschreiben > /dev/null 2>&1; then')
  assert.ok(i >= 0, 'commit-data.sh ruft uhr-in-tests.mjs --festschreiben auf')
  assert.equal(zeilen[i + 1], 'hinzu tools/uhr-in-tests-grenzen.json', 'und stagt danach die Grenzdatei')

  // Der echte Bestand liegt in der Grenze; im Hauptordner (mit fremden Worktrees auf der Platte) kommt dieselbe Zahl heraus.
  const echt = spawnSync(process.execPath, [werkzeug], { encoding: 'utf8', windowsHide: true })
  assert.equal(echt.status, 0, `der echte Bestand liegt in der Grenze: ${echt.stderr}`)
  assert.match(echt.stdout, /^Uhr in Tests in Ordnung: \d+ Vorkommen, höchstens \d+ erlaubt\.$/m)
  console.log('Alle Prüfungen grün.')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
