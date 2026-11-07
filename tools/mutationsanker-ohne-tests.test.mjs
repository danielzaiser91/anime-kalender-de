/** Tests: Mutanten ohne `tests`-Eintrag werden gemeldet (Warnung) und die Zahl je Liste darf nur sinken (tools/mutationen-ohne-tests-bekannt.json). */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ohneTestsEintrag, ratscheLuecken, testsLueckenZeilen } from './mutationsanker.mjs'

const fehler = []
const pruefe = (name, ok) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler.push(name)
  console.error(`  ✗ ${name}`)
}
const m = (name, extra = {}) => ({ name, datei: 'a.ts', suche: 'x', ersetze: 'y', ...extra })
const text = (l) => JSON.stringify(l)

pruefe('Mutant ohne tests: gemeldet', ohneTestsEintrag(text([m('a')])).join() === 'a')
pruefe('Mutant mit tests: nicht gemeldet', ohneTestsEintrag(text([m('a', { tests: ['npx tsx t.ts'] })])).length === 0)
pruefe('leeres tests-Feld zählt als fehlend', ohneTestsEintrag(text([m('a', { tests: [] })])).join() === 'a')
pruefe('nur der Mutant ohne tests, mit Namen', ohneTestsEintrag(text([m('a', { tests: ['t'] }), m('b'), m('c')])).join() === 'b,c')
pruefe('Kontrollmutant ohne Änderungen zählt nicht', ohneTestsEintrag(text([{ name: 'Kontrolle', aenderungen: [] }])).length === 0)
pruefe('mehrere Änderungen ohne tests: gemeldet', ohneTestsEintrag(text([{ name: 'z', aenderungen: [{ datei: 'a.ts', suche: 'x', ersetze: 'y' }] }])).join() === 'z')
pruefe('Paar-Liste und kaputtes JSON: nichts', ohneTestsEintrag(text([['a', 'b']])).length === 0 && ohneTestsEintrag('{ kaputt').length === 0)
const lies = (p) => (p === 'tools/mutationen/x.json' ? text([m('eins'), m('zwei', { tests: ['t'] })]) : null)
pruefe('Warnzeile nennt Liste und Mutantenname', testsLueckenZeilen(['tools/mutationen/x.json'], lies).join() === 'tools/mutationen/x.json: „eins“ ohne tests-Eintrag')
pruefe('fehlende Datei: keine Zeile', testsLueckenZeilen(['tools/mutationen/weg.json'], lies).length === 0)

pruefe('Ratsche: gleich = grün', ratscheLuecken({ 'a.json': 3 }, { 'a.json': 3 }).length === 0)
pruefe('Ratsche: sinkend = grün', ratscheLuecken({ 'a.json': 2 }, { 'a.json': 3 }).length === 0)
pruefe('Ratsche: genau +1 = rot', ratscheLuecken({ 'a.json': 4 }, { 'a.json': 3 }).length === 1)
pruefe('Ratsche: neue Liste mit einem Mutanten ohne tests = rot, erlaubt 0', ratscheLuecken({ 'neu.json': 1 }, { 'a.json': 3 })[0]?.includes('erlaubt 0') === true)
pruefe('Ratsche: neue Liste ohne Lücke = grün', ratscheLuecken({ 'neu.json': 0 }, {}).length === 0)

// Prozess: Warnzeile auf stderr, Exit bleibt 0 (Wegwerf-Ordner).
const wurzel = mkdtempSync(join(tmpdir(), 'mutanker-tests-'))
try {
  writeFileSync(join(wurzel, 'a.ts'), 'eins zwei\n')
  writeFileSync(join(wurzel, 'l.json'), text([{ name: 'ohneT', datei: 'a.ts', suche: 'zwei', ersetze: 'X' }]))
  const skript = fileURLToPath(new URL('./mutationsanker.mjs', import.meta.url))
  const r = spawnSync(process.execPath, [skript, 'l.json'], { cwd: wurzel, encoding: 'utf8', timeout: 60000, windowsHide: true })
  pruefe('Prozess: Exit 0 und Zeile', r.status === 0 && /Mutationsanker: 1 Listen, 1 Mutanten, 0 Anker/.test(r.stdout))
  pruefe('Prozess: Warnzeile mit Liste und Mutant auf stderr', r.stderr.includes('⚠ l.json: „ohneT“ ohne tests-Eintrag'))
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

// Bestand: keine echte Liste über ihrer Grenze (Datei neben diesem Test).
const bekannt = JSON.parse(readFileSync(new URL('./mutationen-ohne-tests-bekannt.json', import.meta.url), 'utf8'))
const ordner = fileURLToPath(new URL('./mutationen/', import.meta.url))
const ist = Object.fromEntries(readdirSync(ordner).filter((n) => n.endsWith('.json')).map((n) => [n, ohneTestsEintrag(readFileSync(join(ordner, n), 'utf8')).length]))
const rot = ratscheLuecken(ist, bekannt)
pruefe(`Bestand: Mutanten ohne tests nur sinkend (${rot.join('; ') || 'ok'})`, rot.length === 0)
pruefe('Bestand: bekannte Liste existiert noch', Object.keys(bekannt).every((n) => n in ist))
const summe = Object.values(ist).reduce((a, b) => a + b, 0)
console.log(`Mutationsanker tests-Lücke: ${Object.keys(ist).length} Listen, ${Object.values(ist).filter(Boolean).length} mit Lücke, ${summe} Mutanten ohne tests-Eintrag`)

if (fehler.length) {
  console.error(`✗ mutationsanker-ohne-tests: ${fehler.length} Fälle rot`)
  process.exit(1)
}
console.log('✓ mutationsanker-ohne-tests: alle Fälle grün')
