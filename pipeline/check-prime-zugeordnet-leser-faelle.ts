/**
 * Fälle zu `check-prime-zugeordnet-leser.ts`: Der Wächter schlägt bei jedem Umgehungsweg an und lässt Kommentare, Prüfdateien und Ausnahmen durch.
 * Läuft in `check:logic`.
 */
import assert from 'node:assert/strict'
import { AUSNAHMEN, pruefeLeser } from './check-prime-zugeordnet-leser.ts'

const NAME = 'prime-zugeordnet.json'
const faelle: [string, { pfad: string; text: string }, number][] = [
  ['roher readJson-Aufruf', { pfad: 'pipeline/x.ts', text: `const a = readJson('data/${NAME}', {})` }, 1],
  ['readFileSync mit join', { pfad: 'pipeline/x.ts', text: `readFileSync(join(ROOT, 'data', '${NAME}'))` }, 1],
  ['Vorlage mit Platzhalter', { pfad: 'tools/x.ts', text: 'lies(`${wurzel}/data/prime-zugeordnet.json`)' }, 1],
  ['Vorlage ohne Platzhalter', { pfad: 'tools/x.ts', text: 'lies(`data/prime-zugeordnet.json`)' }, 1],
  ['Skript .mjs', { pfad: 'tools/x.mjs', text: `JSON.parse(readFileSync(resolve(w, 'data/${NAME}'), 'utf8'))` }, 1],
  ['Alias der Konstante', { pfad: 'worker/src/x.ts', text: `const P = 'data/${NAME}'\nconst Q = P` }, 1],
  ['Generik-Pfeil <T> in .ts verschluckt nichts', { pfad: 'tools/x.ts', text: `const id = <T>(x: T) => x\nJSON.parse(readFileSync('data/${NAME}', 'utf8'))` }, 1],
  ['Type-Assertion <any> in .ts', { pfad: 'tools/x.ts', text: `const a = <any>y\nJSON.parse(readFileSync('data/${NAME}', 'utf8'))` }, 1],
  ['Type-Assertion <any> in .mjs', { pfad: 'tools/x.mjs', text: `const a = <any>y\nJSON.parse(readFileSync('data/${NAME}', 'utf8'))` }, 1],
  ['JSX in .tsx', { pfad: 'web/x.tsx', text: `const a = <div>{lies('data/${NAME}')}</div>` }, 1],
  ['Kommentar ist frei', { pfad: 'pipeline/x.ts', text: `// liest data/${NAME}\n/** ${NAME} */\nconst a = 1` }, 0],
  ['prime-unzugeordnet.json ist ein anderes Ziel', { pfad: 'pipeline/x.ts', text: `lies('data/prime-unzugeordnet.json')` }, 0],
  ['nicht-zugeordnet.json ist ein anderes Ziel', { pfad: 'pipeline/x.ts', text: `lies('data/proposals/nicht-zugeordnet.json')` }, 0],
  ['Prüfdatei check-*', { pfad: 'pipeline/check-x.ts', text: `lies('data/${NAME}')` }, 0],
  ['Testdatei', { pfad: 'tools/x.test.mjs', text: `lies('data/${NAME}')` }, 0],
  ['Markdown wird nicht gelesen', { pfad: 'docs/x.md', text: `data/${NAME}` }, 0],
]

const stuetze = Object.keys(AUSNAHMEN).map((pfad) => ({ pfad, text: `'data/${NAME}'` }))
for (const [name, datei, erwartet] of faelle) {
  const fehler = pruefeLeser([...stuetze, datei])
  assert.equal(fehler.length, erwartet, `${name}: ${fehler.join(' | ')}`)
  if (erwartet) assert.ok(fehler[0]!.includes(datei.pfad), name)
}

const ohneStuetze = pruefeLeser(stuetze.slice(1))
assert.equal(ohneStuetze.length, 1, 'eine Ausnahme ohne den Namen veraltet und wird gemeldet')
assert.ok(ohneStuetze[0]!.includes(stuetze[0]!.pfad))

const eigene = pruefeLeser([{ pfad: 'pipeline/neu.ts', text: `lies('data/${NAME}')` }, ...stuetze], { ...AUSNAHMEN, 'pipeline/neu.ts': 'Grund' })
assert.equal(eigene.length, 0, 'die übergebene Liste gilt')

console.log(`check-prime-zugeordnet-leser-faelle: ${faelle.length + 2} Fälle ok.`)
