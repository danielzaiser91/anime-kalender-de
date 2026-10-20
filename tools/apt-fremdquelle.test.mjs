/**
 * Test zu `tools/apt-fremdquelle.mjs`: die echten Dateien sind grün, jede Verfälschung ist rot.
 * Aufruf: node tools/apt-fremdquelle.test.mjs
 */
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
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
console.log(`apt-fremdquelle.test: grün (${Object.keys(rot).length} Rot-, ${Object.keys(gruen).length} Grünfälle)`)
