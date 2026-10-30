/**
 * Test zu `workflow-ohne-pakete.mjs`: Kulisse in einem Wegwerf-Ordner unter `os.tmpdir()`, die Form des Anlassfalls
 * (delta-wache.yml -> delta-pruefen.mjs -> .ts-Kette -> js-yaml) und je ein Gegenfall pro Umgehungsweg.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { aufrufeAusRun, istFremdpaket, pruefeAlle } from './workflow-ohne-pakete.mjs'

const werkzeug = join(dirname(fileURLToPath(import.meta.url)), 'workflow-ohne-pakete.mjs')

assert.deepEqual(aufrufeAusRun('node tools/a.mjs --tage 1 | tee d.txt').skripte, ['tools/a.mjs'])
assert.deepEqual(aufrufeAusRun('npx tsx pipeline/b.ts --x\nnode -e "1"').skripte, ['pipeline/b.ts'])
assert.deepEqual(aufrufeAusRun('node --max-old-space-size=4 ./tools/c.mjs "$LAGE"').skripte, ['tools/c.mjs'])
assert.deepEqual(aufrufeAusRun('echo hi && node tools/d.mjs').skripte, ['tools/d.mjs'])
assert.deepEqual(aufrufeAusRun('bash tools/s.sh --zeit 2m -- npm run x').shells, ['tools/s.sh'])
assert.deepEqual(aufrufeAusRun('node tools/e.mjs "$a"; node tools/f.mjs').skripte, ['tools/e.mjs', 'tools/f.mjs'])
assert.deepEqual(aufrufeAusRun('echo "node ist da" && ls').skripte, [])
// Hinter Pipe und Umleitung beginnt ein anderer Befehl; ein Skriptname aus einer Shell-Variablen ist unbekannt und zählt nicht.
assert.deepEqual(aufrufeAusRun('node --version | tee tools/log.mjs').skripte, [])
assert.deepEqual(aufrufeAusRun('node --version > tools/log.mjs').skripte, [])
assert.deepEqual(aufrufeAusRun('node tools/$NAME.mjs').skripte, [])
assert.equal(istFremdpaket('js-yaml'), true)
assert.equal(istFremdpaket('@scope/paket'), true)
assert.equal(istFremdpaket('node:fs'), false)
assert.equal(istFremdpaket('fs'), false)
assert.equal(istFremdpaket('fs/promises'), false)
assert.equal(istFremdpaket('../shared/x.ts'), false)

function kulisse(dateien) {
  const wurzel = mkdtempSync(join(tmpdir(), 'ohne-pakete-'))
  for (const [pfad, text] of Object.entries(dateien)) {
    mkdirSync(dirname(join(wurzel, pfad)), { recursive: true })
    writeFileSync(join(wurzel, pfad), text)
  }
  return wurzel
}

const workflow = (schritte) => `name: t\non: push\njobs:\n  j:\n    runs-on: ubuntu-latest\n    steps:\n${schritte}\n`
const nurNode = workflow('      - run: node tools/start.mjs')
const mitInstall = workflow('      - run: npm ci\n      - run: node tools/start.mjs')
const installDanach = workflow('      - run: node tools/start.mjs\n      - run: npm ci')
const mitAktion = workflow('      - uses: ./.github/actions/ein\n      - run: node tools/start.mjs')
const ueberShell = workflow('      - run: bash tools/lauf.sh')

const sauber = {
  'tools/start.mjs': "import { a } from '../pipeline/lib/a.ts'\nimport fs from 'node:fs'\nimport p from 'path'\nconsole.log(a, fs, p)\n",
  'pipeline/lib/a.ts': "import { b } from './b.ts'\nimport type { T } from '../../shared/t.ts'\nexport const a = b\n",
  'pipeline/lib/b.ts': "import { readFileSync } from 'node:fs'\nexport const b = readFileSync\n",
  'shared/t.ts': 'export type T = number\n',
  '.github/actions/ein/action.yml': 'runs:\n  using: composite\n  steps:\n    - run: npm ci\n      shell: bash\n',
  'tools/lauf.sh': '#!/bin/bash\nnode tools/start.mjs\n',
}

function lauf(name, dateien, workflowText) {
  const wurzel = kulisse({ ...sauber, ...dateien, '.github/workflows/w.yml': workflowText })
  try {
    return pruefeAlle(join(wurzel))
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
}

assert.deepEqual(lauf('sauber', {}, nurNode).fehler, [], 'paketfreie Kette ist in Ordnung')

// Anlassfall: das Fremdpaket steckt zwei Ebenen tief in einer .ts-Datei.
const tief = lauf('tief', { 'pipeline/lib/b.ts': "import yaml from 'js-yaml'\nexport const b = yaml\n" }, nurNode)
assert.equal(tief.fehler.length, 1)
assert.match(tief.fehler[0], /^w\.yml \(j\): tools\/start\.mjs braucht js-yaml ohne npm ci: tools\/start\.mjs -> pipeline\/lib\/a\.ts -> pipeline\/lib\/b\.ts$/)

// Umgehungswege des Importleserauf: require, dynamischer Import, Re-Export, Importe nur mit Seiteneffekt.
for (const [name, text] of [
  ['require', "const y = require('js-yaml')\nexport const b = y\n"],
  ['dynamisch', "export const b = import('js-yaml')\n"],
  ['re-export', "export { load } from 'js-yaml'\nexport const b = 1\n"],
  ['seiteneffekt', "import 'js-yaml'\nexport const b = 1\n"],
  ['unterpfad', "import x from 'js-yaml/lib/x.js'\nexport const b = x\n"],
]) {
  const r = lauf(name, { 'pipeline/lib/b.ts': text }, nurNode)
  assert.equal(r.fehler.length, 1, `${name}: genau ein Fund`)
  assert.match(r.fehler[0], /js-yaml/, name)
}

// Dasselbe Paket an zwei Stellen der Kette: eine Meldung.
const doppelt = lauf('doppelt', { 'pipeline/lib/b.ts': "import 'js-yaml'\nexport const b = 1\n", 'pipeline/lib/a.ts': "import 'js-yaml'\nimport { b } from './b.ts'\nexport const a = b\n" }, nurNode)
assert.equal(doppelt.fehler.length, 1)

// Fremdpaket im Startskript selbst, und Zyklus in der Kette hängt nicht.
assert.equal(lauf('start', { 'tools/start.mjs': "import 'js-yaml'\n" }, nurNode).fehler.length, 1)
assert.deepEqual(lauf('zyklus', { 'pipeline/lib/b.ts': "import { a } from './a.ts'\nexport const b = a\n" }, nurNode).fehler, [])

// Versorgung: `npm ci` davor oder eine lokale Aktion mit `npm ci` erlaubt Pakete; `npm ci` erst danach nicht.
const yamlB = { 'pipeline/lib/b.ts': "import yaml from 'js-yaml'\nexport const b = yaml\n" }
assert.deepEqual(lauf('install', yamlB, mitInstall).fehler, [])
assert.deepEqual(lauf('aktion', yamlB, mitAktion).fehler, [])
assert.equal(lauf('danach', yamlB, installDanach).fehler.length, 1, 'npm ci nach dem Schritt schützt ihn nicht')

// Aufruf über ein Shell-Skript wird mitgelesen.
assert.equal(lauf('shell', yamlB, ueberShell).fehler.length, 1)
assert.deepEqual(lauf('shell sauber', {}, ueberShell).fehler, [])

// Eine fehlende Importdatei ist ein Fund („?“), kein stilles Überspringen.
const fehlt = lauf('fehlt', { 'pipeline/lib/b.ts': "import { x } from './gibt-es-nicht.ts'\nexport const b = x\n" }, nurNode)
assert.equal(fehlt.fehler.length, 1)
assert.match(fehlt.fehler[0], /braucht \?/)

// Prozess: Exit 1 mit FEHL-Zeile, Exit 0 mit Ergebniszeile.
for (const [dateien, exit] of [[yamlB, 1], [{}, 0]]) {
  const wurzel = kulisse({ ...sauber, ...dateien, '.github/workflows/w.yml': nurNode })
  try {
    const r = spawnSync(process.execPath, [werkzeug, wurzel], { encoding: 'utf8', windowsHide: true })
    assert.equal(r.status, exit, r.stderr)
    if (exit) assert.match(r.stderr, /^FEHL w\.yml/m)
    else assert.match(r.stdout, /^workflow-ohne-pakete: ok \(1 Workflows/m)
  } finally {
    rmSync(wurzel, { recursive: true, force: true })
  }
}

// Der echte Bestand: kein Workflow ohne Installation braucht ein Fremdpaket.
const echt = pruefeAlle(join(dirname(fileURLToPath(import.meta.url)), '..'))
assert.deepEqual(echt.fehler, [])
assert.ok(echt.anzahl > 20, 'Wächter liest die Workflows (0 wäre blind)')

console.log('workflow-ohne-pakete.test: Aufruf-Erkennung, Anlassfall (js-yaml zwei Ebenen tief), Umgehungen (require, import(), Re-Export, Seiteneffekt, Unterpfad), Versorgung (npm ci davor/danach, Aktion), Shell-Skript, fehlende Datei, Prozess Exit 0/1, echter Bestand grün')
