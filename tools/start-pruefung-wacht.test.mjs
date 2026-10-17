/** Test des Wächters `start-pruefung-wacht.mjs`: findet das Muster in der Mitte, auch mit Leerraum, lässt die richtige Form durch. */
import assert from 'node:assert/strict'
import { findeFehlstarts } from './start-pruefung-wacht.mjs'

const falsch = 'if (import.meta.url === `' + 'file:///' + '${process.argv[1].replace(/a/g, "b")}`) await main()'
const falschLeer = 'x = `' + 'file:///' + '${ process.argv[1] }`'
const richtig = 'if (import.meta.url === pathToFileURL(process.argv[1]).href) await main()'
const andere = 'const u = `file:///${wurzel}/x`'

const texte = { 'a.mjs': richtig, 'b.mjs': falsch, 'c.mjs': andere, 'd.mjs': falschLeer, 'e.mjs': richtig }
assert.deepEqual(findeFehlstarts(texte), ['b.mjs', 'd.mjs'])
assert.deepEqual(findeFehlstarts({ 'a.mjs': richtig, 'c.mjs': andere }), [])
assert.deepEqual(findeFehlstarts({ 'z.mjs': falsch, 'a.mjs': richtig }), ['z.mjs'], 'Treffer an erster Stelle')
assert.deepEqual(findeFehlstarts({ 'a.mjs': richtig, 'y.mjs': falsch }), ['y.mjs'], 'Treffer an letzter Stelle')
console.log('start-pruefung-wacht.test: ok')
