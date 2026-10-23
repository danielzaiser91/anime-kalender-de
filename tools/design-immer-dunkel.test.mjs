/**
 * `.ak-immer-dunkel` (Trailer-Fenster, Beleg-Dialog) muss in beiden Themen lesbar sein, und die Anbieter-Pille muss beim
 * Zeigen sichtbar umschlagen, ohne dass ihre graue Zeile unter 4,5:1 fällt (15.10.2026). Jede Zeile des Blocks einzeln
 * gestrichen oder auf den Wert des hellen Themas gesetzt macht die Prüfung rot; die Pillen-Fläche steht an jeder Stelle über das Token.
 */
import assert from 'node:assert/strict'
import { IMMER_ROLLEN, immerDunkelGleich, immerDunkelKontrast, immerDunkelRot, tabelle } from './design-kontrast.mjs'
import { lies } from './design-quelle.mjs'

const css = lies('styles.css')
assert.deepEqual(immerDunkelRot(css), [], 'Block vollständig')
assert.deepEqual(tabelle(css).rot, [], 'alle Paare über der Schwelle')

const block = css.match(/\.ak-immer-dunkel \{[^}]*\}/)[0]
const zeilen = block.split('\n').filter((z) => z.includes('--ak-'))
const ROLLEN = ['grund', 'flaeche', 'flaeche-2', 'flaeche-3', 'rand', 'linie', 'text', 'leise', 'sehr-leise', 'akzent-text', 'link', 'fokus', 'fehler', 'fehler-text']
assert.deepEqual(IMMER_ROLLEN, ROLLEN, 'Rollenliste der Prüfung')
assert.deepEqual(
  zeilen.map((z) => z.match(/--ak-([a-z0-9-]+):/)[1]),
  ROLLEN,
  'Block trägt genau die erwarteten Rollen',
)
// Rollen mit Text-auf-Fläche-Paar fängt die Kontrastrechnung, die übrigen die Gleichheit mit html.dark.
const MIT_PAAR = ['grund', 'flaeche', 'flaeche-2', 'flaeche-3', 'text', 'leise', 'sehr-leise', 'akzent-text', 'link']
for (const z of zeilen) {
  const name = z.match(/--ak-([a-z0-9-]+):/)[1]
  const ohne = css.replace(block, block.replace(`${z}\n`, ''))
  assert.notEqual(ohne, css, 'Mutation greift')
  const meldung = MIT_PAAR.includes(name) ? 'in .ak-immer-dunkel' : `--ak-${name}`
  assert.ok(immerDunkelRot(ohne).some((m) => m.includes(meldung)), `Streichen von „${z.trim()}“ wird im Gesamturteil rot`)
  const pruefung = MIT_PAAR.includes(name) ? immerDunkelKontrast : immerDunkelGleich
  assert.ok(pruefung(ohne).length > 0, `Streichen von --ak-${name} wird von der zuständigen Prüfung rot`)
}
// Auf den Wert des hellen Themas gesetzt (Rückmutation des Fehlstands, bei dem der Block den Wert nicht setzte).
const hell = { grund: '#f5f4f0', flaeche: '#ffffff', 'flaeche-2': '#ebe9e3', 'flaeche-3': '#e4e1da', rand: '#d6d3cb', linie: '#e2dfd8' }
Object.assign(hell, { text: '#15171c', leise: '#555b66', 'sehr-leise': '#636974', 'akzent-text': '#b8321a', fokus: '#b8321a', fehler: '#e11d48', 'fehler-text': '#a8002c' })
for (const [name, wert] of Object.entries(hell)) {
  const z = zeilen.find((l) => l.includes(`--ak-${name}:`))
  const mut = css.replace(block, block.replace(z, z.replace(/#[0-9a-f]{6}/i, wert)))
  assert.notEqual(mut, css, 'Mutation greift')
  assert.ok(immerDunkelRot(mut).length > 0, `Wert von --ak-${name} auf den hellen Wert wird rot`)
}
// Link zeigt auf die Rolle des Blocks, nicht auf eine geerbte: ohne eigene Zeile erbt er das helle Rot.
assert.ok(immerDunkelRot(css.replace(block, block.replace('--ak-link: var(--ak-akzent-text);', '--ak-link: #b8321a;'))).length > 0, 'heller Link wird rot')

assert.ok(tabelle(css.replace('--ak-pille-hover: #26344f;', '--ak-pille-hover: #2a3a58;')).rot.length > 0, 'alte Hover-Stufe: graue Zeile fällt unter 4,5:1')
assert.ok(tabelle(css.replace('--ak-pille: #162238;', '--ak-pille: #3a4a6a;')).rot.some((m) => m.includes('leise auf pille ')), 'graue Zeile auf der Ruhe-Fläche unter 4,5:1')
// Text zwischen 3:1 und 4,5:1 muss rot sein (nicht erst unter 3:1).
assert.ok(immerDunkelKontrast(css.replace(block, block.replace('--ak-leise: #9aa0ab;', '--ak-leise: #707682;'))).length > 0, 'leise mit 3,3:1 wird rot')
assert.ok(immerDunkelRot(css.replace('--ak-pille-hover: #26344f;', '--ak-pille-hover: #1b202a;')).length > 0, 'zu schwache Hover-Stufe wird rot')

/** Die Pillen-Flächen einzeln: jede Stelle trägt `bg-ak-pille` bzw. den Hover über das Token, nie eine feste Fläche. */
const stellen = [
  ['components/detail/pille.tsx', /const PILLE_MARKE =\s*'([^']*)'/, 'bg-ak-pille'],
  ['components/detail/pille.tsx', /const PILLE_OHNE_MARKE = '([^']*)'/, 'bg-ak-pille'],
  ['components/detail/pille.tsx', /className=\{`([^`]*rounded-xl[^`]*)`\}/, 'hover:bg-ak-pille-hover'],
  ['components/detail/pillen.tsx', /className="([^"]*cursor-pointer items-center gap-2\.5[^"]*)"/, 'bg-ak-pille'],
  ['components/detail/pillen.tsx', /className="([^"]*cursor-pointer items-center gap-2\.5[^"]*)"/, 'hover:bg-ak-pille-hover'],
  ['components/detail/merken-optik.ts', /mitFarbe\s*\? '([^']*)'/, 'bg-ak-pille'],
  ['components/detail/merken-optik.ts', /mitFarbe\s*\? '([^']*)'/, 'hover:bg-ak-pille-hover'],
]
for (const [datei, muster, erwartet] of stellen) {
  const treffer = lies(datei).match(muster)
  assert.ok(treffer, `${datei}: ${muster} gefunden`)
  const klassen = treffer[1].split(/\s+/)
  assert.ok(klassen.includes(erwartet), `${datei}: ${erwartet} in ${muster}`)
  assert.deepEqual(klassen.filter((k) => /^(hover:)?bg-(white|slate|ak-flaeche)/.test(k)), [], `${datei}: keine feste Fläche neben dem Token`)
  assert.doesNotMatch(treffer[1], /162238/, `${datei}: keine feste Pillen-Farbe`)
}
console.log('design-immer-dunkel: ok')
