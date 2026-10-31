/** Tests für tools/pr-stufe-kette.mjs und die Handwerkzeug-Regel von tools/pr-stufe.mjs, gegen ein Wegwerf-Repo unter os.tmpdir(). */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bestimmeStufe } from './pr-stufe.mjs'
import { istHandwerkzeug, leseKette } from './pr-stufe-kette.mjs'

const fehler = []
const pruefe = (name, ist, soll) => {
  if (ist === soll) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name} — ${ist}`)
}

const wurzel = mkdtempSync(join(tmpdir(), 'pr-stufe-kette-'))
const schreibe = (pfad, text) => {
  const voll = join(wurzel, pfad)
  mkdirSync(join(voll, '..'), { recursive: true })
  writeFileSync(voll, text)
}
// Werkzeuge: hand (nur von Hand), wf (Workflow), npm (package.json), liste (Prüfliste), helfer (von Kettenwerkzeug importiert), ohnetest
for (const n of ['hand', 'wf', 'npm', 'liste', 'helfer', 'ohnetest', 'kettenwerk']) schreibe(`tools/${n}.mjs`, '// werkzeug\n')
for (const n of ['hand', 'wf', 'npm', 'liste', 'helfer', 'kettenwerk']) schreibe(`tools/${n}.test.mjs`, `import './${n}.mjs'\n`)
schreibe('.github/workflows/lauf.yml', 'run: node tools/wf.mjs\nrun: node tools/kettenwerk.mjs\n')
schreibe('package.json', '{"scripts":{"x":"node tools/npm.mjs"}}')
schreibe('tools/check-logic-liste.txt', 'tools/liste.test.mjs\ntools/liste.mjs\n')
schreibe('tools/kettenwerk.mjs', "import './helfer.mjs'\n")
const kette = leseKette(wurzel)
const stufe = (...pfade) => bestimmeStufe(pfade.map((pfad) => ({ pfad, hinzu: ['x'], weg: [] })), kette).stufe

pruefe('Handwerkzeug mit Test → true', istHandwerkzeug('tools/hand.mjs', kette), true)
pruefe('Workflow ruft auf → false', istHandwerkzeug('tools/wf.mjs', kette), false)
pruefe('npm-Skript ruft auf → false', istHandwerkzeug('tools/npm.mjs', kette), false)
pruefe('Prüfliste nennt es → false', istHandwerkzeug('tools/liste.mjs', kette), false)
pruefe('von Kettenwerkzeug importiert → false', istHandwerkzeug('tools/helfer.mjs', kette), false)
pruefe('ohne eigenen Test → false', istHandwerkzeug('tools/ohnetest.mjs', kette), false)
pruefe('Test eines Handwerkzeugs → true', istHandwerkzeug('tools/hand.test.mjs', kette), true)
pruefe('Test eines Workflow-Werkzeugs → false', istHandwerkzeug('tools/wf.test.mjs', kette), false)
pruefe('Unterordner → false', istHandwerkzeug('tools/claude-global/x.mjs', kette), false)
pruefe('ohne Kette → false', istHandwerkzeug('tools/hand.mjs', null), false)
pruefe('Namensteil (hand-x) zählt nicht als Aufruf von hand', istHandwerkzeug('tools/hand.mjs', { quellen: [{ pfad: 'a', text: 'tools/hand-x.mjs' }], tests: ['hand.test.mjs'] }), true)

pruefe('PR: Handwerkzeug + Test → 1', stufe('tools/hand.mjs', 'tools/hand.test.mjs'), 1)
pruefe('PR: Workflow-Werkzeug + Test → 2', stufe('tools/wf.mjs', 'tools/wf.test.mjs'), 2)
pruefe('PR: npm-Werkzeug → 2', stufe('tools/npm.mjs'), 2)
pruefe('PR: Prüflisten-Werkzeug → 2', stufe('tools/liste.mjs'), 2)
pruefe('PR: Handwerkzeug + Workflow-Eintrag im selben PR → 2', stufe('tools/hand.mjs', '.github/workflows/lauf.yml'), 2)
pruefe('PR: Handwerkzeug + package.json im selben PR → 2', stufe('tools/hand.mjs', 'package.json'), 2)
pruefe('PR: Handwerkzeug + pipeline → 2', stufe('tools/hand.mjs', 'pipeline/lib/x.ts'), 2)
pruefe('PR: neues Werkzeug samt neuem Test (nicht im Repo) → 1', stufe('tools/neu.mjs', 'tools/neu.test.mjs'), 1)
pruefe('PR: neues Werkzeug ohne Test → 2', stufe('tools/neu.mjs'), 2)
pruefe('PR: Handwerkzeug ohne Kette → 2', bestimmeStufe([{ pfad: 'tools/hand.mjs', hinzu: ['x'], weg: [] }]).stufe, 2)

rmSync(wurzel, { recursive: true, force: true })
if (fehler.length) {
  console.error(`\n${fehler.length} Fälle fehlgeschlagen`)
  process.exit(1)
}
console.log('pr-stufe-kette: alle Fälle grün')
