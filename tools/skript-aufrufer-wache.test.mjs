/** Gegenprobe zu `tools/skript-aufrufer-wache.mjs`: Aufruf `node tools/skript-aufrufer-wache.test.mjs`. */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { istPruefskript, nenntSkript, ohneAufrufer, pruefeAufrufer } from './skript-aufrufer-wache.mjs'

const PROGRAMM = 'console.log(1)\n'
const MIT_START = 'export function f() {}\nif (process.argv[1] === x) f()\n'
const BIBLIOTHEK = 'export function f() {}\n'

const lauf = (dateien, ausnahmenText = '') => ohneAufrufer({ dateien: new Map(Object.entries(dateien)), ausnahmenText })
const pruefe = (name, dateien, erwartet, ausnahmenText) => {
  const fehler = lauf(dateien, ausnahmenText)
  assert.equal(fehler.length, erwartet, `${name}: ${fehler.join(' | ')}`)
  console.log(`  ✓ ${name}`)
}

assert.equal(istPruefskript('tools/a-pruefen.mjs', PROGRAMM), true)
assert.equal(istPruefskript('tools/a-pruefen.mjs', MIT_START), true)
assert.equal(istPruefskript('tools/a-pruefen.mjs', BIBLIOTHEK), false, 'Bibliothek zählt nicht')
assert.equal(istPruefskript('tools/a-pruefen.test.mjs', PROGRAMM), false, 'Test zählt nicht')
assert.equal(istPruefskript('tools/anzeigen.mjs', PROGRAMM), false, 'Name ohne Prüfwort')
assert.equal(istPruefskript('pipeline/lib/check-x.ts', PROGRAMM), false, 'Unterordner zählt nicht')
assert.equal(istPruefskript('pipeline/check-x.ts', PROGRAMM), true)
assert.equal(nenntSkript('node tools/a-pruefen.mjs', 'tools/a-pruefen.mjs'), true)
assert.equal(nenntSkript('xa-pruefen.mjs', 'tools/a-pruefen.mjs'), false, 'Wortteil trifft nicht')
assert.equal(nenntSkript('a-pruefen.mjs.bak', 'tools/a-pruefen.mjs'), false, 'längere Endung trifft nicht')
assert.equal(nenntSkript("import './check-x'", 'pipeline/check-x.ts'), true, 'ts ohne Endung')
console.log('  ✓ Erkennung')

const S = { 'tools/a-pruefen.mjs': PROGRAMM }
pruefe('ohne Aufrufer ist rot', S, 1)
pruefe('package.json ruft auf', { ...S, 'package.json': '{"scripts":{"x":"node tools/a-pruefen.mjs"}}' }, 0)
pruefe('Workflow ruft auf', { ...S, '.github/workflows/w.yml': 'run: node tools/a-pruefen.mjs' }, 0)
pruefe('Liste ruft auf', { ...S, 'tools/check-logic-liste.txt': 'tools/a-pruefen.mjs' }, 0)
pruefe('nur ein Test ruft auf: rot', { ...S, 'tools/a-pruefen.test.mjs': "spawn('tools/a-pruefen.mjs')" }, 1)
pruefe('nur die Ausnahmeliste nennt es: rot ohne Eintrag', { ...S, 'tools/skript-aufrufer-ausnahmen.txt': 'tools/a-pruefen.mjs # x' }, 1)
pruefe('docs zählen nicht', { ...S, 'docs/x.md': 'tools/a-pruefen.mjs' }, 1)
pruefe('Ausnahme mit Grund deckt', S, 0, 'tools/a-pruefen.mjs # Handwerkzeug')
pruefe('Ausnahme ohne Grund ist rot', S, 1, 'tools/a-pruefen.mjs')
pruefe('Ausnahme mit leerem Grund ist rot', S, 1, 'tools/a-pruefen.mjs #  ')
pruefe('Ausnahme ohne Datei ist rot', {}, 1, 'tools/weg-pruefen.mjs # x')
pruefe('überflüssige Ausnahme ist rot', { ...S, 'package.json': 'tools/a-pruefen.mjs' }, 1, 'tools/a-pruefen.mjs # x')
pruefe('Bibliothek ohne Aufrufer ist in Ordnung', { 'tools/b-pruefen.mjs': BIBLIOTHEK }, 0)
pruefe('Ausnahme für eine Bibliothek ist rot', { 'tools/b-pruefen.mjs': BIBLIOTHEK }, 1, 'tools/b-pruefen.mjs # x')
pruefe('zwei Skripte, eines ohne Aufrufer', { ...S, 'tools/c-wache.mjs': PROGRAMM, 'package.json': 'tools/c-wache.mjs' }, 1)

const echt = pruefeAufrufer(fileURLToPath(new URL('..', import.meta.url)))
assert.deepEqual(echt.fehler, [], `Repo: ${echt.fehler.join(' | ')}`)
assert.ok(echt.geprueft > 50, `Repo: ${echt.geprueft} Prüfskripte erkannt, erwartet mehr als 50`)
console.log(`  ✓ Repo: ${echt.geprueft} Prüfskripte`)

const prozess = spawnSync(process.execPath, [fileURLToPath(new URL('./skript-aufrufer-wache.mjs', import.meta.url))], { encoding: 'utf8', windowsHide: true })
assert.equal(prozess.status, 0, prozess.stderr)
assert.match(prozess.stdout, /^skript-aufrufer-wache: \d+ Prüfskripte/m)
console.log('skript-aufrufer-wache.test: grün')
