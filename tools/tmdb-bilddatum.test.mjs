/**
 * Prüft die Datierung des TMDB-Altbestands (`tools/tmdb-bilddatum.mjs`): Abruftag = Tag des ersten Commits mit demselben Wert,
 * Schlüsselfolge und vorhandenes Datum ändern den Vergleich nicht, `null` bleibt ohne Datum, ein zweiter Lauf ändert nichts.
 * Aufruf: node tools/tmdb-bilddatum.test.mjs
 */
import assert from 'node:assert/strict'
import { datiere, erstesAuftreten, kanonisch } from './tmdb-bilddatum.mjs'

const verlauf = [
  { tag: '2026-10-07', daten: { 1: { p: '/a.jpg', w: 2, h: 3 } } },
  { tag: '2026-10-11', daten: { 1: { p: '/a.jpg', w: 2, h: 3 }, 2: { p: '/b.jpg', w: 2, h: 3 } } },
  { tag: '2026-10-12', daten: { 1: { p: '/neu.jpg', w: 2, h: 3 }, 2: { p: '/b.jpg', w: 2, h: 3 }, 3: null } },
]

assert.equal(kanonisch({ w: 2, p: '/a.jpg', h: 3 }), kanonisch({ p: '/a.jpg', h: 3, w: 2, inhaltAm: '2026-01-01' }), 'Schlüsselfolge und Datum zählen nicht')
assert.notEqual(kanonisch({ p: '/a.jpg' }, true), kanonisch({ p: '/a.jpg', inhaltAm: '2026-01-01' }, true), 'mit Stand zählt das Datum')

assert.equal(erstesAuftreten(verlauf, '1', { p: '/a.jpg', w: 2, h: 3 }), '2026-10-07', 'unveränderter Eintrag: erster Commit')
assert.equal(erstesAuftreten(verlauf, '1', { p: '/neu.jpg', w: 2, h: 3 }), '2026-10-12', 'geänderter Wert: Commit der Änderung')
assert.equal(erstesAuftreten(verlauf, '2', { p: '/b.jpg', w: 2, h: 3 }), '2026-10-11')
assert.equal(erstesAuftreten(verlauf, '9', { p: '/x.jpg' }), undefined, 'nie committet: unbekannt')

const daten = { 1: { p: '/a.jpg', w: 2, h: 3 }, 2: { p: '/b.jpg', w: 2, h: 3, inhaltAm: '2026-10-12' }, 3: null, 9: { p: '/x.jpg' } }
const r = datiere(daten, (e) => e !== null, verlauf, '2026-10-13')
assert.equal(daten[1].inhaltAm, '2026-10-07')
assert.equal(daten[2].inhaltAm, '2026-10-12', 'vorhandenes Datum bleibt')
assert.equal(daten[3], null, 'null bleibt null')
assert.equal(daten[9].inhaltAm, '2026-10-12', 'ohne Fund: Tag des letzten Commits')
assert.deepEqual([r.datiert, r.ersatz], [2, 1])
assert.equal(datiere(daten, (e) => e !== null, verlauf, '2026-10-13').datiert, 0, 'zweiter Lauf ändert nichts')

console.log('TMDB-Bilddatum: alle Zusicherungen halten.')
