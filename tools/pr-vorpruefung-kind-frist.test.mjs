/** Tests: `kindFristNoetig` und `kindFristRot` (Vorprüfung fährt die Kind-Frist-Ratsche nur bei berührten Tests, Kulissen, Stand oder Ratsche). */
import assert from 'node:assert/strict'
import { kindFristNoetig, kindFristRot } from './pr-vorpruefung-kind-frist.mjs'

const JA = [
  'tools/x.test.mjs',
  'tools/x.test.ts',
  'tools/x.test.tsx',
  'tools/x-kulisse.mjs',
  'tools/x-mock.mjs',
  'tools/test-kind-frist-stand.json',
  'tools/test-kind-frist.mjs',
]
const NEIN = ['README.md', 'tools/x.mjs', 'tools/x.test.js', 'tools/unter/x.test.mjs', 'fremd/tools/x.test.mjs', 'pipeline/x.test.mjs', 'tools/test-kind-frist.json', 'tools/test-kind-frist-stand.txt']
for (const d of JA) assert.equal(kindFristNoetig(['README.md', d]), true, `${d} berührt die Ratsche`)
for (const d of NEIN) assert.equal(kindFristNoetig([d]), false, `${d} berührt die Ratsche nicht`)
assert.equal(kindFristNoetig([]), false, 'leerer Diff')

let aufrufe = 0
const fahre = () => (aufrufe++, ['rot'])
assert.deepEqual(kindFristRot(['README.md'], fahre), [], 'ohne berührte Datei leer')
assert.equal(aufrufe, 0, 'Ratsche nicht gefahren')
assert.deepEqual(kindFristRot(['tools/x.test.ts'], fahre), ['rot'], 'mit berührter Datei die Befunde')
assert.equal(aufrufe, 1, 'Ratsche genau einmal gefahren')

console.log(`pr-vorpruefung-kind-frist.test: ok (${JA.length} Treffer-Pfade, ${NEIN.length} Nicht-Treffer, Fahrt nur bei Treffer)`)
