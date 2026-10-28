/**
 * Kopierlisten der Wegwerf-Repo-Tests gegen den Importgraph (Bauer 2123 und 1647: je ein roter Lauf, weil eine neu
 * importierte Datei in der Kopie fehlte). Jede von den Einstiegen transitiv erreichte Datei aus `tools/` muss in der
 * Liste stehen; fehlt eine, ist dieser Test lokal rot, bevor der Lauf rot wird.
 * Aufruf: `node tools/kopierlisten-importgraph.test.mjs`
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { abschluss, direkteNachbarn } from './importgraph.mjs'

const WURZEL = resolve(import.meta.dirname, '..')
const lies = (pfad) => readFileSync(join(WURZEL, pfad), 'utf8')

/** Erreichte Dateien, die weder kopiert noch ausdrücklich ausgenommen sind. */
export const fehlende = (erreicht, kopiert, ausnahmen = []) => erreicht.filter((d) => !kopiert.includes(d) && !ausnahmen.includes(d))

const wacheKopien = () => [...lies('tools/wache-verdrahtung.test.mjs').match(/^const KOPIEN = \[(.*)\]$/m)[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
const commitKopien = () => lies('tools/commit-data-test.sh').match(/for datei in ([^;]+); do/)[1].trim().split(/\s+/)

// `if node tools/<x>.mjs --festschreiben` in commit-data.sh ist ein Ratschen-Aufruf, der im Wegwerf-Repo bewusst ins Leere läuft;
// kopiert, würde er dort Grenzdateien festschreiben. umfang-ketten.mjs kommt nur über umfang-pruefen.mjs.
const COMMIT_AUSNAHMEN = ['design-klassen.mjs', 'heute-utc.mjs', 'uhr-in-tests.mjs', 'umfang-pruefen.mjs', 'umfang-ketten.mjs']

function prueffaelleGraph() {
  assert.deepEqual(direkteNachbarn('a.mjs', "import { x } from './b.mjs'\nconst c = require('./c.cjs')\nawait import('./d.mjs')\nimport y from 'node:fs'\nimport z from '../pipeline/z.ts'\n"), ['b.mjs', 'c.cjs', 'd.mjs'])
  assert.deepEqual(direkteNachbarn('a.mjs', "// import { x } from './kommentar.mjs'\n/* require('./block.cjs') */\nimport { y } from './echt.mjs'\n"), ['echt.mjs'])
  assert.deepEqual(direkteNachbarn('a.sh', '# node tools/kommentar.mjs\nnode tools/echt.mjs x\nsource "$(dirname "${BASH_SOURCE[0]}")/lib.sh"\n'), ['echt.mjs', 'lib.sh'])
  const ordner = mkdtempSync(join(tmpdir(), 'kopierlisten-'))
  try {
    mkdirSync(join(ordner, 'tools'))
    writeFileSync(join(ordner, 'tools', 'start.mjs'), "import './mitte.mjs'\nimport './start.mjs'\n")
    writeFileSync(join(ordner, 'tools', 'mitte.mjs'), "import './ende.mjs'\nimport './fehlt.mjs'\n")
    writeFileSync(join(ordner, 'tools', 'ende.mjs'), 'export {}\n')
    assert.deepEqual(abschluss(['start.mjs'], ordner), ['ende.mjs', 'mitte.mjs', 'start.mjs'], 'transitiv, Kreis ok, fehlende Datei übersprungen')
  } finally {
    rmSync(ordner, { recursive: true, force: true })
  }
  assert.deepEqual(fehlende(['a', 'b', 'c'], ['a'], ['c']), ['b'])
  assert.deepEqual(fehlende(['a'], ['a'], []), [])
}

prueffaelleGraph()
const wache = abschluss(['check-logic-alle.mjs', 'tests-alle.mjs'], WURZEL)
assert.ok(wache.length >= 8, `wache-verdrahtung: Importgraph leer (${wache.length})`)
assert.deepEqual(fehlende(wache, wacheKopien()), [], 'KOPIEN in tools/wache-verdrahtung.test.mjs: erreichte Dateien fehlen')
const commit = abschluss(['commit-data.sh'], WURZEL)
assert.ok(commit.length >= 10, `commit-data-test: Importgraph leer (${commit.length})`)
assert.deepEqual(fehlende(commit, commitKopien(), COMMIT_AUSNAHMEN), [], 'Kopierliste in tools/commit-data-test.sh: erreichte Dateien fehlen')
console.log(`kopierlisten-importgraph.test: ok (wache-verdrahtung ${wache.length} erreicht, commit-data-test ${commit.length} erreicht, ${COMMIT_AUSNAHMEN.length} ausgenommen)`)
