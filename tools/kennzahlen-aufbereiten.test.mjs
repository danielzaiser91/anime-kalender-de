import assert from 'node:assert/strict'
import { leseAlles } from './kennzahlen-daten-erzeugen.mjs'
import { baueAnsichtsDaten, markerZuordnen, reihe, wert, wochenmittel } from './kennzahlen-aufbereiten.mjs'

assert.equal(wert({ stau: { offen: 4 } }, 'stau.offen'), 4)
assert.equal(wert({ stau: {} }, 'stau.offen'), null)
assert.equal(wert({}, 'seite.metaGzipKb'), null)
assert.equal(wert({ a: 0 }, 'a'), 0, 'Null ist ein Wert')

// Wochenmittel: Lücken zählen nicht mit (nicht als 0)
assert.deepEqual(wochenmittel([2, 4, 6, 8], 3), [2, 3, 4, 6])
assert.deepEqual(wochenmittel([null, 4, null, null, 10], 2), [null, 4, 4, null, 10])
assert.deepEqual(wochenmittel([0, 0, 3], 7), [0, 0, 1])
assert.deepEqual(wochenmittel([1, 2, 3, 4, 5, 6, 7, 70], 7), [1, 1.5, 2, 2.5, 3, 3.5, 4, 13.86])

const tage = [{ tag: '2026-10-01', stau: { offen: 1 } }, { tag: '2026-10-02' }, { tag: '2026-10-03', stau: { offen: 5 } }]
assert.deepEqual(reihe(tage, 'stau.offen'), [1, null, 5])

const m = [
  { datum: '2026-10-03', pr: 7, text: 'a', kennzahl: 'x', richtung: 'sinkt' },
  { datum: '2026-09-01', pr: 1, text: 'vorher', kennzahl: 'x', richtung: 'sinkt' },
  { datum: '2026-10-01', pr: 2, text: 'b', kennzahl: 'y', richtung: 'sinkt' },
]
assert.deepEqual(markerZuordnen(m, tage).map((x) => [x.index, x.pr]), [[2, 7], [0, 2]])

const d = baueAnsichtsDaten(tage, m, { '2026-10-02': { geschafft: ['x'], probleme: [] } })
assert.deepEqual(d.tage, ['2026-10-01', '2026-10-02', '2026-10-03'])
assert.deepEqual(d.kennzahlen.find((k) => k.pfad === 'stau.offen').werte, [1, null, 5])
assert.deepEqual(d.kennzahlen.find((k) => k.pfad === 'stau.offen').wochenmittel, [1, 1, 3])
assert.equal(d.marker.length, 2)
assert.deepEqual(d.kernpunkte['2026-10-02'].geschafft, ['x'])
console.log('kennzahlen-aufbereiten: ok (Wochenmittel, Lücken, Marker, Gesamtaufbau)')

// Echte Dateien: YAML-Daten müssen Zeichenketten bleiben (sonst 0 Marker), Marker liegen im Tagesbereich
const echt = leseAlles()
assert.equal(typeof echt.massnahmen[0].datum, 'string')
const echtDaten = baueAnsichtsDaten(echt.tage, echt.massnahmen, echt.kernpunkte)
assert.equal(echtDaten.marker.length, echt.massnahmen.length, 'jede Maßnahme liegt im Zeitraum der Tage')
assert.equal(echtDaten.kennzahlen[0].werte.length, echt.tage.length)
console.log('echte Daten:', echtDaten.tage.length, 'Tage,', echtDaten.marker.length, 'Marker')
