/**
 * Test der Bühnen-Ansicht „entwurf“: Nutzer-Fälle (`nutzer-faelle.ts`), Wahl des Entwurfs je Variante (`entwurf-wahl.ts`,
 * Vorher = heutige Seite oder „Neu“) und die Vorschläge des Prüfstein-Mockups.
 */
import assert from 'node:assert/strict'
import { waehleEntwurf } from '../web/buehne/entwurf-wahl.ts'
import { NUTZER_FAELLE, nutzerAus } from '../web/buehne/nutzer-faelle.ts'
import { waehleVorschlaege } from '../web/buehne/mockups/empfehlung-reise-wahl.ts'

const ids = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]

// Nutzer-Fälle: gemerkt und gesehen überschneiden sich nicht, verschiedene Zahlen, Grenze mit genau 1, mehr als vorhanden.
assert.deepEqual(nutzerAus(ids, { merkliste: 3, verlauf: 5 }), { merkliste: [10, 11, 12], verlauf: [13, 14, 15, 16, 17] })
assert.deepEqual(nutzerAus(ids, { merkliste: 0, verlauf: 0 }), { merkliste: [], verlauf: [] })
assert.deepEqual(nutzerAus(ids, { merkliste: 1, verlauf: 2 }), { merkliste: [10], verlauf: [11, 12] })
assert.deepEqual(nutzerAus([10, 11], { merkliste: 3, verlauf: 5 }), { merkliste: [10, 11], verlauf: [] })
assert.deepEqual(Object.keys(NUTZER_FAELLE), ['nutzer-neu', 'nutzer-aktiv'])
assert.deepEqual(NUTZER_FAELLE['nutzer-aktiv'], { name: 'Nutzer: 3 gemerkt, 5 gesehen', merkliste: 3, verlauf: 5 })

// Entwurfswahl: Vorher (leer) ist die heutige Seite oder nichts, nie ein Entwurf; unbekannte Variante und fehlendes Mockup: nichts.
const heute = () => null
const a = () => null
const b = () => null
const def = { name: 'x', titel: 'x', ausschnitt: 'entwurf', faelle: [], varianten: { A: { ersatz: {}, entwurf: a }, B: { ersatz: {}, entwurf: b }, C: { ersatz: {} } } }
assert.equal(waehleEntwurf(def, 'A'), a)
assert.equal(waehleEntwurf(def, 'B'), b)
assert.equal(waehleEntwurf(def, ''), undefined)
assert.equal(waehleEntwurf({ ...def, vorher: heute }, ''), heute)
assert.equal(waehleEntwurf({ ...def, vorher: heute }, 'A'), a)
assert.equal(waehleEntwurf(def, 'C'), undefined)
assert.equal(waehleEntwurf({ ...def, vorher: heute }, 'C'), undefined)
assert.equal(waehleEntwurf(def, 'Z'), undefined)
assert.equal(waehleEntwurf(undefined, 'A'), undefined)

// Vorschläge: ohne Nutzer die ersten fünf; gesehene fehlen, gemerkte stehen vorn, genau ein Gesehenes.
assert.deepEqual(waehleVorschlaege(ids, undefined, 5), [10, 11, 12, 13, 14])
assert.deepEqual(waehleVorschlaege(ids, { merkliste: [], verlauf: [10] }, 2), [11, 12])
assert.deepEqual(waehleVorschlaege(ids, { merkliste: [15], verlauf: [] }, 3), [15, 10, 11])
assert.deepEqual(waehleVorschlaege(ids, { merkliste: [10, 11, 12], verlauf: [13, 14, 15, 16, 17] }, 5), [10, 11, 12, 18, 19])
assert.deepEqual(waehleVorschlaege(ids, { merkliste: [10], verlauf: [10] }, 2), [11, 12])

console.log('buehne-entwurf.test: ok')
