/** Gegenprobe zu `tools/check-logic-vollstaendig.mjs`: Aufruf `node tools/check-logic-vollstaendig.test.mjs`. */
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { pruefeVollstaendig, unverdrahtet } from './check-logic-vollstaendig.mjs'

const basis = { dateien: [], listen: new Set(['pipeline/check-a.ts']), skripte: 'tsx pipeline/check-b.ts && node tools/c.test.ts', ausnahmen: [] }
const pruefe = (name, eingabe, erwartet) => {
  const fehler = unverdrahtet({ ...basis, ...eingabe })
  assert.equal(fehler.length, erwartet, `${name}: ${fehler.join(' | ')}`)
  console.log(`  ✓ ${name}`)
}

pruefe('Datei in der Liste', { dateien: ['pipeline/check-a.ts'] }, 0)
pruefe('Datei in einem package.json-Skript', { dateien: ['pipeline/check-b.ts', 'tools/c.test.ts'] }, 0)
pruefe('tools/*.test.mjs läuft über tests-alle', { dateien: ['tools/x.test.mjs'] }, 0)
pruefe('pipeline/*.test.mjs hat kein tests-alle', { dateien: ['pipeline/x.test.mjs'] }, 1)
pruefe('tools/*.test.mjs in der Liste läuft doppelt', { dateien: ['tools/x.test.mjs'], listen: new Set(['tools/x.test.mjs']) }, 1)
pruefe('Name nur als Präfix im Skript trifft nicht', { dateien: ['pipeline/check-b.ts.bak'], skripte: 'tsx pipeline/check-b.ts.bak2' }, 1)
pruefe('Präfix eines längeren Namens trifft nicht', { dateien: ['pipeline/check-b.ts'], skripte: 'tsx pipeline/check-b.tsx' }, 1)
pruefe('Unverdrahtete Datei ist rot', { dateien: ['pipeline/check-z.ts'] }, 1)
pruefe('Ausnahme deckt die Datei', { dateien: ['pipeline/check-z.ts'], ausnahmen: ['pipeline/check-z.ts'] }, 0)
pruefe('Ausnahme ohne Datei ist rot', { dateien: [], ausnahmen: ['pipeline/check-z.ts'] }, 1)
pruefe('überflüssige Ausnahme ist rot', { dateien: ['pipeline/check-a.ts'], ausnahmen: ['pipeline/check-a.ts'] }, 1)

const echt = pruefeVollstaendig(fileURLToPath(new URL('..', import.meta.url)))
assert.deepEqual(echt, [], `Repo: ${echt.join(' | ')}`)
console.log('  ✓ Repo ist vollständig verdrahtet')
console.log('check-logic-vollstaendig.test: grün')
