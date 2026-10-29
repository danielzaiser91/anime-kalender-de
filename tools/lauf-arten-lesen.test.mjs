import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { artenAusAnzeige } from './lauf-arten-lesen.mjs'

const fest = "const ARTEN = [\n  { kurz: 'A', lang: 'Eins' },\n  { kurz: 'B', lang: 'Zwei — x' },\n]\nconst ANDERE = [\n  { kurz: 'C', lang: 'Drei' },\n]\n"
assert.deepEqual(artenAusAnzeige(fest), ['Eins', 'Zwei — x'])
assert.deepEqual(artenAusAnzeige(''), [])

const ANZEIGE = 'C:/code/ai/__assets/tools/lauf-status/index.html'
if (existsSync(ANZEIGE)) {
  const arten = artenAusAnzeige(readFileSync(ANZEIGE, 'utf8'))
  const workflows = readdirSync('.github/workflows').filter((f) => f.endsWith('.yml')).length
  assert.ok(arten.length > 0, 'keine Lauf-Arten gelesen')
  assert.equal(arten.length, workflows, `Anzeige ${arten.length} gegen ${workflows} Workflows`)
  console.log(`lauf-arten-lesen: ok (${arten.length} Lauf-Arten aus der Anzeige)`)
} else {
  console.log('lauf-arten-lesen: ok (echte Anzeige übersprungen)')
}
