/**
 * `.ak-immer-dunkel` (Trailer-Fenster, Beleg-Dialog) muss in beiden Themen lesbar sein, und die Anbieter-Pille muss beim
 * Zeigen sichtbar umschlagen (15.10.2026). Mutation: jede Zeile aus dem Block gestrichen macht die Prüfung rot, sobald das
 * helle Thema ihren Wert erbt und dadurch unter 4,5:1 fällt.
 */
import assert from 'node:assert/strict'
import { immerDunkelRot } from './design-kontrast.mjs'
import { lies } from './design-quelle.mjs'

const css = lies('styles.css')
assert.deepEqual(immerDunkelRot(css), [], 'Block vollständig')

const block = css.match(/\.ak-immer-dunkel \{[^}]*\}/)[0]
const zeilen = block.split('\n').filter((z) => /--ak-(grund|flaeche|flaeche-2|flaeche-3|text|leise|sehr-leise|akzent-text):/.test(z))
assert.ok(zeilen.length >= 7, 'Block trägt die Flächen- und Textrollen')
let rot = 0
for (const z of zeilen) {
  const ohne = css.replace(block, block.replace(`${z}\n`, ''))
  assert.notEqual(ohne, css, 'Mutation greift')
  if (immerDunkelRot(ohne).length > 0) rot += 1
}
assert.ok(rot >= 4, `Streichen einer Zeile wird rot (${rot} von ${zeilen.length})`)
assert.ok(immerDunkelRot(css.replace(/--ak-pille-hover: #2a3a58;/, '--ak-pille-hover: #1b202a;')).length > 0, 'zu schwache Pille-Hover-Stufe wird rot')

for (const datei of ['components/detail/pille.tsx', 'components/detail/pillen.tsx', 'components/detail/merken-optik.ts']) {
  assert.doesNotMatch(lies(datei), /162238/, `${datei}: keine feste Pillen-Farbe`)
  assert.match(lies(datei), /bg-ak-pille/, `${datei}: Pillen-Fläche über Token`)
  assert.match(lies(datei), /hover:bg-ak-pille-hover/, `${datei}: Hover über Token`)
}
console.log('design-immer-dunkel: ok')
