/** Gegenprobe zu `tools/skript-aufrufer-wache.mjs`: Aufruf `node tools/skript-aufrufer-wache.test.mjs`. */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { istPruefskript, nenntSkript, ohneAufrufer, pruefeAufrufer } from './skript-aufrufer-wache.mjs'

const PROGRAMM = 'console.log(1)\n'
const MIT_START = 'export function f() {}\nif (process.argv[1] === x) f()\n'
const BIBLIOTHEK = 'export function f() {}\n'
const LIB_MIT_LAUF = 'export function f() {}\nif (!f()) process.exit(1)\n'
const LIB_START_IM_KOMMENTAR = '// if (process.argv[1] === x) f()\n/* process.exit(1) */\nexport function f() {}\n'
const paket = (skript) => JSON.stringify({ scripts: { x: skript } })
const workflow = (run) => `jobs:\n  j:\n    steps:\n      - run: ${run}\n`

const lauf = (dateien, ausnahmenText = '') => ohneAufrufer({ dateien: new Map(Object.entries(dateien)), ausnahmenText })
const pruefe = (name, dateien, erwartet, ausnahmenText) => {
  const fehler = lauf(dateien, ausnahmenText)
  assert.equal(fehler.length, erwartet, `${name}: ${fehler.join(' | ')}`)
  console.log(`  ✓ ${name}`)
}

assert.equal(istPruefskript('tools/a-pruefen.mjs', PROGRAMM), true)
assert.equal(istPruefskript('tools/a-pruefen.mjs', MIT_START), true)
assert.equal(istPruefskript('tools/a-pruefen.mjs', BIBLIOTHEK), false, 'Bibliothek zählt nicht')
assert.equal(istPruefskript('tools/a-pruefen.mjs', LIB_MIT_LAUF), true, 'export mit Top-Level-Lauf ist ein Programm (A5)')
assert.equal(istPruefskript('tools/a-pruefen.mjs', LIB_START_IM_KOMMENTAR), false, 'Startform nur im Kommentar (A5)')
assert.equal(istPruefskript('tools/a-pruefen.test.mjs', PROGRAMM), false, 'Test zählt nicht')
assert.equal(istPruefskript('tools/anzeigen.mjs', PROGRAMM), false, 'Name ohne Prüfwort')
for (const wort of ['zugangs-waechter', 'x-verify', 'x-audit', 'x-wache', 'x-sperre', 'x-guard', 'x-valid', 'x-lint', 'x-gate', 'x-check', 'x-pruefen']) {
  assert.equal(istPruefskript(`tools/${wort}.mjs`, PROGRAMM), true, `Namenswort ${wort} (A1)`)
}
for (const pfad of ['tools/x-check.ts', 'tools/x-check.mts', 'tools/x-check.js', 'tools/x-check.cjs', 'tools/lib/x-check.mjs', 'pipeline/bau/x-check.ts', 'pipeline/check-x.ts']) {
  assert.equal(istPruefskript(pfad, PROGRAMM), true, `erfasst: ${pfad} (A4)`)
}
for (const pfad of ['web/x-check.ts', 'worker/src/x-check.ts', 'tools/x-check.json', 'tools/x-check.tsx']) {
  assert.equal(istPruefskript(pfad, PROGRAMM), false, `bewusst nicht erfasst: ${pfad} (A4: nur tools/ und pipeline/, nur Skriptendungen)`)
}
assert.equal(nenntSkript('node tools/a-pruefen.mjs', 'tools/a-pruefen.mjs'), true)
assert.equal(nenntSkript('xa-pruefen.mjs', 'tools/a-pruefen.mjs'), false, 'Wortteil trifft nicht')
assert.equal(nenntSkript('a-pruefen.mjs.bak', 'tools/a-pruefen.mjs'), false, 'längere Endung trifft nicht')
assert.equal(nenntSkript("import './check-x'", 'pipeline/check-x.ts'), true, 'ts ohne Endung nach Schrägstrich')
assert.equal(nenntSkript("import './check-x.js'", 'pipeline/check-x.ts'), true, 'ts über .js')
assert.equal(nenntSkript("const a = 'check'", 'pipeline/check.ts'), false, 'Zeichenkettenwort ohne Pfad zählt nicht (A6)')
assert.equal(nenntSkript('{"check": 1}', 'pipeline/check.ts'), false, 'JSON-Schlüssel zählt nicht (A6)')
console.log('  ✓ Erkennung')

const S = { 'tools/a-pruefen.mjs': PROGRAMM }
pruefe('ohne Aufrufer ist rot', S, 1)
pruefe('package.json ruft auf', { ...S, 'package.json': paket('node tools/a-pruefen.mjs') }, 0)
pruefe('package.json in Unterordner ruft auf', { ...S, 'tools/claude-global/hooks/package.json': paket('node tools/a-pruefen.mjs') }, 0)
pruefe('Workflow ruft auf', { ...S, '.github/workflows/w.yml': workflow('node tools/a-pruefen.mjs') }, 0)
pruefe('Action ruft auf', { ...S, '.github/actions/a/action.yml': workflow('node tools/a-pruefen.mjs') }, 0)
pruefe('Liste ruft auf', { ...S, 'tools/check-logic-liste.txt': 'tools/a-pruefen.mjs\n' }, 0)
pruefe('Bestandsliste ruft auf', { ...S, 'tools/check-bestand-liste.txt': 'tools/a-pruefen.mjs\n' }, 0)
pruefe('nur ein Test ruft auf: rot', { ...S, 'tools/a-pruefen.test.mjs': "spawn('tools/a-pruefen.mjs')" }, 1)
pruefe('nur die Ausnahmeliste nennt es: rot ohne Eintrag', { ...S, 'tools/skript-aufrufer-ausnahmen.txt': 'tools/a-pruefen.mjs # x' }, 1)
pruefe('docs zählen nicht', { ...S, 'docs/x.md': 'tools/a-pruefen.mjs' }, 1)

// A2: Kommentare zählen nicht.
const A = 'tools/a-pruefen.mjs'
pruefe('A2 Zeilenkommentar im Skript', { ...S, 'package.json': paket('node tools/b.mjs'), 'tools/b.mjs': `// ruft ${A} auf\n` }, 1)
pruefe('A2 Blockkommentar im Skript', { ...S, 'package.json': paket('node tools/b.mjs'), 'tools/b.mjs': `/* ${A} */\n` }, 1)
pruefe('A2 Shell-Kommentar', { ...S, 'package.json': paket('bash tools/b.sh'), 'tools/b.sh': `# node ${A}\n` }, 1)
pruefe('A2 Shell-Aufruf zählt', { ...S, 'package.json': paket('bash tools/b.sh'), 'tools/b.sh': `node ${A}\n` }, 0)
pruefe('A2 auskommentierte Listenzeile', { ...S, 'tools/check-logic-liste.txt': `# ${A}\n` }, 1)
pruefe('A2 Listenzeile mit Zeilenende-Kommentar zählt', { ...S, 'tools/check-logic-liste.txt': `${A} # Grund\n` }, 0)
pruefe('A2 description in package.json', { ...S, 'package.json': JSON.stringify({ description: A, scripts: { x: 'echo' } }) }, 1)
pruefe('A2 YAML-Kommentar im Workflow', { ...S, '.github/workflows/w.yml': `# node ${A}\n${workflow('echo')}` }, 1)
pruefe('A2 Workflow-Schlüssel außerhalb run', { ...S, '.github/workflows/w.yml': `paths:\n  - ${A}\n${workflow('echo')}` }, 1)

// A3: Waisen rufen nichts auf; Aufrufer müssen selbst erreicht sein.
pruefe('A3 Zweier-Kreis von Waisen', { 'tools/a-pruefen.mjs': 'node tools/b-pruefen.mjs', 'tools/b-pruefen.mjs': `node ${A}` }, 2)
pruefe('A3 Nicht-Prüfskript-Waise ruft auf', { ...S, 'tools/messen-x.mjs': `node ${A}` }, 1)
pruefe('A3 Kette Kern → Zwischenskript → Prüfskript', { ...S, 'package.json': paket('node tools/messen-x.mjs'), 'tools/messen-x.mjs': `node ${A}` }, 0)
pruefe('A3 Kette über zwei Stufen', { ...S, 'package.json': paket('bash tools/s.sh'), 'tools/s.sh': 'node tools/t.mjs', 'tools/t.mjs': `node ${A}` }, 0)

// A6: Pipeline-Wort in Zeichenkette.
pruefe('A6 Wort in web/x.ts zählt nicht', { 'pipeline/check.ts': PROGRAMM, 'package.json': paket('node web/x.ts'), 'web/x.ts': "const a = 'check'" }, 1)
pruefe('A6 Import ohne Endung zählt', { 'pipeline/check-x.ts': PROGRAMM, 'package.json': paket('tsx pipeline/main.ts'), 'pipeline/main.ts': "import './check-x'" }, 0)

pruefe('Ausnahme mit Grund deckt', S, 0, 'tools/a-pruefen.mjs # Handwerkzeug')
pruefe('Ausnahme ohne Grund ist rot', S, 1, 'tools/a-pruefen.mjs')
pruefe('Ausnahme mit leerem Grund ist rot', S, 1, 'tools/a-pruefen.mjs #  ')
pruefe('Ausnahme ohne Datei ist rot', {}, 1, 'tools/weg-pruefen.mjs # x')
pruefe('überflüssige Ausnahme ist rot', { ...S, 'package.json': paket(A) }, 1, 'tools/a-pruefen.mjs # x')
pruefe('Bibliothek ohne Aufrufer ist in Ordnung', { 'tools/b-pruefen.mjs': BIBLIOTHEK }, 0)
pruefe('Ausnahme für eine Bibliothek ist rot', { 'tools/b-pruefen.mjs': BIBLIOTHEK }, 1, 'tools/b-pruefen.mjs # x')
pruefe('export mit Top-Level-Lauf ohne Aufrufer ist rot (A5)', { 'tools/b-pruefen.mjs': LIB_MIT_LAUF }, 1)
pruefe('zwei Skripte, eines ohne Aufrufer', { ...S, 'tools/c-wache.mjs': PROGRAMM, 'package.json': paket('node tools/c-wache.mjs') }, 1)

const echt = pruefeAufrufer(fileURLToPath(new URL('..', import.meta.url)))
assert.deepEqual(echt.fehler, [], `Repo: ${echt.fehler.join(' | ')}`)
assert.ok(echt.geprueft > 50, `Repo: ${echt.geprueft} Prüfskripte erkannt, erwartet mehr als 50`)
console.log(`  ✓ Repo: ${echt.geprueft} Prüfskripte`)

// Exit-Code als eigener Prozess an einem Wegwerf-Repo mit einem Prüfskript ohne Aufrufer.
const ordner = mkdtempSync(join(tmpdir(), 'skript-aufrufer-'))
try {
  spawnSync('git', ['init', '-q', ordner], { windowsHide: true })
  mkdirSync(join(ordner, 'tools'))
  writeFileSync(join(ordner, 'tools/x-pruefen.mjs'), PROGRAMM)
  const wache = fileURLToPath(new URL('./skript-aufrufer-wache.mjs', import.meta.url))
  const rot = spawnSync(process.execPath, [wache, ordner], { encoding: 'utf8', windowsHide: true })
  assert.equal(rot.status, 1, 'Prüfskript ohne Aufrufer: Exit 1')
  assert.match(rot.stderr, /^check:logic: tools\/x-pruefen\.mjs hat keinen Aufrufer/m)
  writeFileSync(join(ordner, 'package.json'), paket('node tools/x-pruefen.mjs'))
  const gruen = spawnSync(process.execPath, [wache, ordner], { encoding: 'utf8', windowsHide: true })
  assert.equal(gruen.status, 0, gruen.stderr)
  assert.match(gruen.stdout, /^skript-aufrufer-wache: 1 Prüfskripte/m)
  console.log('  ✓ Exit-Code im Wegwerf-Repo (ohne und mit Aufrufer)')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
console.log('skript-aufrufer-wache.test: grün')
