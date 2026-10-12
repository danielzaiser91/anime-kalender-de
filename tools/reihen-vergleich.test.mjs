// Prüft die Rechnung von `reihen-vergleich`: neu/weg/geändert, Reihenfolge, Beschriftung, Staffelstand, gleiche Stände.
import assert from 'node:assert/strict'
import { beschreibeReihen, berechneReihen, vergleicheReihen } from './reihen-vergleich-logik.mjs'

// Titelmodul-Ersatz: Beschriftung "Staffel <Position>" für jedes Glied, Stand "<Position>/<Anzahl>".
const modul = (praefix) => ({
  reihenVertreter: (g) => g[0],
  ohneStaffelEins: (n) => n,
  reihenAnfang: (kopf) => kopf,
  hauptstaffeln: (g) => g,
  staffelBeschriftungen: (g) => new Map(g.map((m, i) => [m.id, `${praefix} ${i + 1}`])),
  staffelStaende: (g) => new Map(g.map((m, i) => [m.id, { staffel: i + 1, von: g.length }])),
})
const reihe = (...ids) => ids.map((id) => ({ id, name: `T${id}` }))
const titelDe = new Map()

const alt = berechneReihen({ 1: reihe(1, 2), 5: reihe(5, 6), 9: reihe(9, 10) }, titelDe, modul('Staffel'))

const gleich = vergleicheReihen(alt, berechneReihen({ 1: reihe(1, 2), 5: reihe(5, 6), 9: reihe(9, 10) }, titelDe, modul('Staffel')))
assert.deepEqual([gleich.neu, gleich.weg, gleich.geaendert, gleich.gleich], [[], [], [], 3])

const neu = berechneReihen({ 1: reihe(2, 1), 5: reihe(5, 6, 7), 7: reihe(7) }, titelDe, modul('Staffel'))
const v = vergleicheReihen(alt, neu)
assert.deepEqual(v.neu.map((r) => r.schluessel), ['7'])
assert.deepEqual(v.weg.map((r) => r.schluessel), ['9'])
const felder = (s) => v.geaendert.find((r) => r.schluessel === s).aenderungen.map((c) => c.feld)
assert.deepEqual(felder('1'), ['name', 'reihenfolge', 'beschriftung', 'beschriftung', 'stand', 'stand'])
assert.deepEqual(felder('5'), ['anzahl', 'glieder dazu', 'beschriftung', 'stand', 'stand', 'stand'])

// Dieselben Daten, andere Regel: Beschriftung ändert sich ohne Datenänderung (PR-903-Fall).
const regel = vergleicheReihen(alt, berechneReihen({ 1: reihe(1, 2), 5: reihe(5, 6), 9: reihe(9, 10) }, titelDe, modul('Teil')))
assert.equal(regel.geaendert.length, 3)
assert.equal(regel.geaendert[0].aenderungen[0].alt, 'Staffel 1')
assert.equal(regel.geaendert[0].aenderungen[0].neu, 'Teil 1')

const zeilen = beschreibeReihen(v, 2)
assert.match(zeilen[0], /1 neu, 1 weg, 2 geändert, 0 gleich/)
assert.ok(zeilen.some((z) => z.includes('… und 4 weitere')))
console.log('reihen-vergleich: ok')
