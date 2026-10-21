/**
 * Test zu `tools/apt-fremdquelle.mjs`: die echten Dateien sind grün, jede Verfälschung ist rot.
 * Aufruf: node tools/apt-fremdquelle.test.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pruefeAlle, pruefeAptQuelle } from './apt-fremdquelle.mjs'

assert.deepEqual(pruefeAlle(resolve(import.meta.dirname, '..')), [], 'echte Workflows müssen grün sein')

const ENTFERNEN = { name: 'weg', run: 'sudo grep -l packages.microsoft.com /etc/apt/sources.list.d/* | sudo xargs -r rm -f || true' }
const job = (...schritte) => ({ jobs: { a: { steps: schritte } } })
const aktion = (...schritte) => ({ runs: { using: 'composite', steps: schritte } })
const INSTALL = { name: 'Chromium', run: 'npx playwright install --with-deps chromium' }
const DEPS = { name: 'Deps', run: 'npx playwright install-deps chromium' }
const APT = { name: 'apt', run: 'sudo apt-get install -y foo' }
const OHNE_APT = { name: 'npm', run: 'npm ci' }
/** Rot-Fälle: eine Zeile je Fall, Schlüssel eindeutig. */
const rot = {
  'install --with-deps ohne Entfernen': job(INSTALL),
  'install-deps ohne Entfernen': job(DEPS),
  'apt-get ohne Entfernen': job(APT),
  'Entfernen erst nach dem Aufruf': job(INSTALL, ENTFERNEN),
  'Aktion: install-deps ohne Entfernen': aktion(OHNE_APT, DEPS),
  'Entfernen nur in anderem Job': { jobs: { a: { steps: [ENTFERNEN] }, b: { steps: [INSTALL] } } },
  'Schritt nur mit Quellennennung, ohne rm': job({ run: 'echo packages.microsoft.com' }, INSTALL),
  'zweiter Aufruf, Entfernen fehlt davor im zweiten Job': { jobs: { a: { steps: [ENTFERNEN, INSTALL] }, b: { steps: [DEPS] } } },
}
for (const [fall, doc] of Object.entries(rot)) {
  assert.equal(pruefeAptQuelle(doc, 'x.yml').length, 1, `${fall}: muss genau einen Verstoß melden`)
}

const gruen = {
  'Entfernen vor install': job(ENTFERNEN, INSTALL),
  'Entfernen vor install-deps in Aktion': aktion(ENTFERNEN, OHNE_APT, DEPS),
  'Entfernen vor beiden Aufrufen': job(ENTFERNEN, INSTALL, DEPS, APT),
  'kein apt-Aufruf': job(OHNE_APT),
  'leeres Dokument': {},
  'Job ohne Schritte': { jobs: { a: {} } },
}
for (const [fall, doc] of Object.entries(gruen)) {
  assert.deepEqual(pruefeAptQuelle(doc, 'x.yml'), [], `${fall}: muss grün sein`)
}
// Verzeichnisfälle: je ein Verstoß in einem Workflow UND einer Action, damit weder das Überspringen von .github/actions noch von .github/workflows noch ein leeres Ergebnis durchgeht.
const wfRot = 'jobs:\n  a:\n    steps:\n      - run: npx playwright install --with-deps chromium\n'
const akRot = 'runs:\n  using: composite\n  steps:\n    - run: npx playwright install-deps chromium\n'
const gruenWf = 'jobs:\n  a:\n    steps:\n      - run: npm ci\n'
const gruenAk = 'runs:\n  using: composite\n  steps:\n    - run: npm ci\n'
function baum(wf, ak) {
  const w = mkdtempSync(join(tmpdir(), 'apt-fremdquelle-'))
  mkdirSync(join(w, '.github/workflows'), { recursive: true })
  mkdirSync(join(w, '.github/actions/x'), { recursive: true })
  writeFileSync(join(w, '.github/workflows/w.yml'), wf)
  writeFileSync(join(w, '.github/actions/x/action.yml'), ak)
  return w
}
const beide = baum(wfRot, akRot)
const nurWf = baum(wfRot, gruenAk)
const nurAk = baum(gruenWf, akRot)
const keine = baum(gruenWf, gruenAk)
assert.deepEqual(pruefeAlle(beide).map((f) => f.split(':')[0]).sort(), ['.github/actions/x/action.yml', '.github/workflows/w.yml'], 'Workflow und Action je ein Verstoß')
assert.equal(pruefeAlle(nurWf).length, 1, 'nur Workflow rot')
assert.equal(pruefeAlle(nurAk).length, 1, 'nur Action rot')
assert.equal(pruefeAlle(keine).length, 0, 'beide grün')

// Verdrahtung: der Läufer von check:logic führt das Skript wirklich aus (Ergebniszeile im Log), der Exit-Code kommt an, und die Prüfliste enthält es.
const WURZEL = resolve(import.meta.dirname, '..')
const liste = join(mkdtempSync(join(tmpdir(), 'apt-liste-')), 'liste.txt')
writeFileSync(liste, 'tools/apt-fremdquelle.mjs\n')
const lauf = (...args) => spawnSync(process.execPath, args, { cwd: WURZEL, encoding: 'utf8', windowsHide: true })
const skriptGruen = lauf('tools/apt-fremdquelle.mjs', keine)
assert.equal(skriptGruen.status, 0)
assert.match(skriptGruen.stdout, /^apt-fremdquelle: 0 Verstöße$/m)
const skriptRot = lauf('tools/apt-fremdquelle.mjs', beide)
assert.equal(skriptRot.status, 1, 'Verstoß muss Exit 1 geben')
assert.match(skriptRot.stdout, /^apt-fremdquelle: 2 Verstöße$/m)
const echt = lauf('tools/check-logic-alle.mjs', liste, 'check:test')
assert.equal(echt.status, 0, echt.stdout + echt.stderr)
assert.match(echt.stdout, /apt-fremdquelle: 0 Verstöße/, 'Läufer führt das Skript aus')
const eintraege = readFileSync(join(WURZEL, 'tools/check-logic-liste.txt'), 'utf8').split('\n')
assert.ok(eintraege.includes('tools/apt-fremdquelle.mjs'), 'Skript steht in der Prüfliste von check:logic')
console.log(`apt-fremdquelle.test: grün (${Object.keys(rot).length} Rot-, ${Object.keys(gruen).length} Grünfälle)`)
