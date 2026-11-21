/**
 * Tests zu tools/pr-vorpruefung-hinweise.mjs: neue Mutanten ohne `tests` und Patch-Notes-Stempel (feste Tage, keine Uhr).
 */
import assert from 'node:assert/strict'
import { mutantenOhneTestsHinweise, neuerTestBasisHinweise, stempelHinweise } from './pr-vorpruefung-hinweise.mjs'

const LISTE = 'tools/mutationen/x.json'
const mut = (name, tests) => ({ name, aenderungen: [{ datei: 'a.ts', suche: 'a', ersetze: 'b' }], ...(tests ? { tests } : {}) })
const text = (...m) => JSON.stringify(m)
const hinweise = (kopf, basis, dateien = [LISTE]) => mutantenOhneTestsHinweise(dateien, () => kopf, () => basis)

// Mutanten
assert.equal(hinweise(text(mut('neu')), null).length, 1, 'neuer Mutant ohne tests -> Hinweis')
assert.match(hinweise(text(mut('neu')), null)[0], /x\.json: neuer Mutant „neu“ ohne Feld tests/, 'Hinweis nennt Liste und Mutant')
assert.equal(hinweise(text(mut('neu', ['npx tsx t.ts'])), null).length, 0, 'Mutant mit tests -> kein Hinweis')
assert.equal(hinweise(text(mut('alt')), text(mut('alt'))).length, 0, 'schon auf main ohne tests (Altfall) -> kein Hinweis')
assert.deepEqual(hinweise(text(mut('alt'), mut('neu')), text(mut('alt'))).length, 1, 'neben einem Altfall zählt nur der neue')
assert.equal(hinweise(text({ name: 'Kontrolle', aenderungen: [] }), null).length, 0, 'Kontrolle braucht keine tests')
assert.equal(hinweise(text(mut('neu')), null, ['tools/andere.json']).length, 0, 'Liste außerhalb von tools/mutationen zählt nicht')
assert.equal(mutantenOhneTestsHinweise([LISTE], () => null, () => null).length, 0, 'gelöschte Liste -> kein Hinweis')
assert.equal(hinweise('kaputt', null).length, 0, 'kaputte Liste meldet der Ankerwächter, nicht dieser Hinweis')

// Stempel
const M = 'M\tdata/patchnotes/a.yaml'
const HEUTE = '2026-11-14'
assert.equal(stempelHinweise(M, '2026-11-13\n', HEUTE).length, 1, 'umgeschrieben, Stempel gestern -> Hinweis')
assert.match(stempelHinweise(M, '2026-11-13\n', HEUTE)[0], /steht auf 2026-11-13 statt 2026-11-14/, 'Hinweis nennt beide Tage')
assert.equal(stempelHinweise(M, '2026-11-14\n', HEUTE).length, 0, 'Stempel heute -> kein Hinweis')
assert.equal(stempelHinweise(M, null, HEUTE).length, 1, 'Stempel fehlt -> Hinweis')
assert.equal(stempelHinweise('A\tdata/patchnotes/neu.yaml', '2026-11-13', HEUTE).length, 0, 'neuer Eintrag verlangt keinen Stempel')
assert.equal(stempelHinweise('D\tdata/patchnotes/a.yaml', '2026-11-13', HEUTE).length, 0, 'gelöschter Eintrag verlangt keinen Stempel')
assert.equal(stempelHinweise('M\tdata/patchnotes/vorrat/a.yaml', '2026-11-13', HEUTE).length, 0, 'Unterordner zählt nicht')
assert.equal(stempelHinweise('M\tdocs/a.md', '2026-11-13', HEUTE).length, 0, 'andere Datei zählt nicht')
assert.equal(stempelHinweise('', '2026-11-13', HEUTE).length, 0, 'leerer Diff -> kein Hinweis')

// Neuer Test ohne Basis-Beleg
const NEU = 'A\ttools/x.test.mjs'
const BELEG = 'Beleg: gegen die Basis rot (Fall 2 ✖)'
assert.equal(neuerTestBasisHinweise(NEU, 'Neuer Test, grün.').length, 1, 'neuer Test ohne Beleg -> Hinweis')
assert.match(neuerTestBasisHinweise(NEU, '')[0], /tools\/x\.test\.mjs: kein Beleg „rot an der Basis“/, 'Hinweis nennt die Datei')
assert.equal(neuerTestBasisHinweise(NEU, BELEG).length, 0, 'Beleg „Basis … rot“ -> kein Hinweis')
assert.equal(neuerTestBasisHinweise(NEU, 'Rot an der Basis: ✖ Fall 1').length, 0, 'Beleg „rot … Basis“ in anderer Folge/Schreibweise')
assert.equal(neuerTestBasisHinweise(NEU, 'Basis geprüft.\nTest rot.').length, 1, 'Wörter in verschiedenen Zeilen belegen nichts')
assert.equal(neuerTestBasisHinweise('M\ttools/x.test.mjs', '').length, 0, 'geänderter Test zählt nicht (nur neue Dateien)')
assert.equal(neuerTestBasisHinweise('A\ttools/x.mjs', '').length, 0, 'neue Nicht-Testdatei zählt nicht')
assert.equal(neuerTestBasisHinweise('A\ttools/testdaten/y.test.mjs', '').length, 0, 'Testdaten-Fixture zählt nicht')
assert.equal(neuerTestBasisHinweise('A\ttools/a.test.mjs\nA\tpipeline/b.test.ts', '').length, 1, 'mehrere neue Tests -> ein Hinweis')
assert.match(neuerTestBasisHinweise('A\ttools/a.test.mjs\nA\tpipeline/b.test.ts', '')[0], /a\.test\.mjs, pipeline\/b\.test\.ts/, 'alle neuen Tests genannt')
assert.equal(neuerTestBasisHinweise('', '').length, 0, 'leerer Diff -> kein Hinweis')

console.log('pr-vorpruefung-hinweise.test: ok (Mutanten ohne tests: neu, Altfall, Kontrolle, fremde/gelöschte/kaputte Liste; Stempel: gestern, heute, fehlt, neu, gelöscht, Unterordner; neuer Test ohne Basis-Beleg)')
