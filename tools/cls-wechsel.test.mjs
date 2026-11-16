import assert from 'node:assert/strict'
import { clsSumme, GRENZE } from './cls-wechsel.mjs'
import { DATEN_VERZOEGERUNG_MS, fussUrteil, LADEFAELLE } from './cls-erstladen.mjs'

// Summe der Verschiebungen, Eingaben ausgenommen (Werte wie vom Messlauf auf main: Fuß 0,2491)
assert.equal(clsSumme([]), 0)
assert.equal(clsSumme([{ value: 0.2491, hadRecentInput: false }]), 0.2491)
assert.equal(clsSumme([{ value: 0.1, hadRecentInput: false }, { value: 0.05, hadRecentInput: false }]), 0.15)
assert.equal(clsSumme([{ value: 0.3, hadRecentInput: true }, { value: 0.02, hadRecentInput: false }]), 0.02)
assert.equal(GRENZE, 0.1)
console.log('cls-wechsel: clsSumme in Ordnung (leer, Summe, Eingabe ausgenommen)')

// Ladezustände (cls-erstladen), je Bedingung ein roter Fall. frei: kein Platzhalter, kein Hinweis, Fuß sichtbar
assert.equal(fussUrteil({ platz: 0, fuss: 'visible', hinweis: 0 }, 'frei'), true)
assert.equal(fussUrteil({ platz: 1, fuss: 'visible', hinweis: 0 }, 'frei'), false)
assert.equal(fussUrteil({ platz: 0, fuss: 'hidden', hinweis: 0 }, 'frei'), false)
assert.equal(fussUrteil({ platz: 0, fuss: 'fehlt', hinweis: 0 }, 'frei'), false)
assert.equal(fussUrteil({ platz: 0, fuss: 'visible', hinweis: 1 }, 'frei'), false)
// ladend: Platzhalter steht, Fuß verborgen, Hinweis wie verlangt (undefined = egal)
assert.equal(fussUrteil({ platz: 1, fuss: 'hidden', hinweis: 1 }, 'ladend', 1), true)
assert.equal(fussUrteil({ platz: 0, fuss: 'hidden', hinweis: 1 }, 'ladend', 1), false)
assert.equal(fussUrteil({ platz: 1, fuss: 'visible', hinweis: 1 }, 'ladend', 1), false)
assert.equal(fussUrteil({ platz: 1, fuss: 'hidden', hinweis: 0 }, 'ladend', 1), false)
assert.equal(fussUrteil({ platz: 1, fuss: 'hidden', hinweis: 1 }, 'ladend', 0), false)
assert.equal(fussUrteil({ platz: 1, fuss: 'hidden', hinweis: 0 }, 'ladend'), true)
assert.deepEqual(LADEFAELLE.map((f) => `${f.erwartet}:${f.verhalten}`), [
  'ladend:haengen', 'ladend:haengen', 'ladend:haengen', 'ladend:verzoegern', 'ladend:verzoegern',
  'frei:abweisen', 'frei:abweisen', 'frei:haengen', 'frei:haengen', 'frei:haengen',
])
// Ohne Verzögerung gewinnt das Laden gegen das erste Zeichnen, und die Messung sieht den Sprung nicht (Prüfer 4042, N3)
assert.ok(DATEN_VERZOEGERUNG_MS >= 200, `Datenverzögerung ${DATEN_VERZOEGERUNG_MS} ms ist zu klein`)
console.log('cls-erstladen: fussUrteil, Ladefälle und Mindest-Verzögerung in Ordnung')
