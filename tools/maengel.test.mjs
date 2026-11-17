/**
 * Test von `tools/maengel.mjs` (Übersicht und `--top` des Mängel-Registers): Rangfolge nach Wirkung, bei gleicher Wirkung
 * Termin in 30 Tagen vor späterem Termin vor keinem, dann laufend vor beendet, dann Titelrang `tr`; Filter `--wer`.
 */
import assert from 'node:assert/strict'
import { laeuft, nextTop, terminStufe, uebersicht } from './maengel.mjs'

const HEUTE = '2026-11-16'
const zeile = (t, art, wirkung, wer, status = 'offen') => ({ t, art, wirkung, wer, status, seit: '2026-11-01' })
const register = {
  zeilen: [
    zeile(1, 'fsk', 2, 'auto:justwatch'),
    zeile(1, 'kein-weg', 3, 'daniel'),
    zeile(2, 'cover', 3, 'auto:tmdb-poster'),
    zeile(3, 'cover', 3, 'auto:tmdb-poster'),
    zeile(4, 'cover', 3, 'auto:tmdb-poster'),
    zeile(5, 'cover', 3, 'auto:tmdb-poster'),
    zeile(6, 'banner', 1, 'auto:tmdb-banner'),
    zeile(7, 'cover', 3, 'auto:tmdb-poster', 'behoben'),
  ],
}
const titel = [
  { id: 1, titleDe: 'Eins', tr: 50, jpEnd: '2020-01-01' },
  { id: 2, titleDe: 'Zwei', tr: 40, jpEnd: '2020-01-01' },
  { id: 3, titleDe: 'Drei', tr: 30, jpEnd: '2020-01-01' },
  { id: 4, titleDe: 'Vier', tr: 20 },
  { id: 5, titleDe: 'Fünf', tr: 10 },
  { id: 6, titleDe: 'Sechs', tr: 1 },
  { id: 7, titleDe: 'Sieben', tr: 2 },
]
const events = [
  { titleId: 3, date: '2026-11-20' },
  { titleId: 5, date: '2027-03-01' },
  { titleId: 2, date: '2026-11-01' },
]

assert.equal(terminStufe(3, events, HEUTE), 0, 'Termin in 30 Tagen: Stufe 0')
assert.equal(terminStufe(5, events, HEUTE), 1, 'Termin später: Stufe 1')
assert.equal(terminStufe(2, events, HEUTE), 2, 'nur ein vergangener Termin: wie keiner')
assert.equal(terminStufe(9, events, HEUTE), 2, 'kein Termin: Stufe 2')

const alle = nextTop(register, titel, events, HEUTE, 10)
assert.deepEqual(alle.map((e) => e.t), [3, 5, 4, 2, 1, 6], 'Wirkung vor Termin: 3 (Termin ≤ 30 T), 5 (später), 4 (laufend), 2 (beendet, Rang 40), 1 (Wirkung 3 durch kein-weg, Rang 50), 6 (Wirkung 1); behobene Zeile fehlt')
assert.deepEqual(alle.find((e) => e.t === 1).arten, ['fsk', 'kein-weg'], 'alle offenen Arten des Titels, höchste Wirkung zählt')
assert.equal(alle.find((e) => e.t === 1).wirkung, 3)
assert.ok(!alle.some((e) => e.t === 7), 'behoben zählt nicht')

assert.deepEqual(nextTop(register, titel, events, HEUTE, 2).map((e) => e.t), [3, 5], 'N begrenzt')
assert.deepEqual(nextTop(register, titel, events, HEUTE, 10, 'daniel').map((e) => e.t), [1], '--wer daniel: nur Zeilen dieser Klasse')
assert.deepEqual(nextTop(register, titel, events, HEUTE, 10, 'auto').map((e) => e.t), [3, 5, 4, 2, 1, 6], '--wer auto: Klasse vor dem Doppelpunkt')
assert.deepEqual(nextTop(register, titel, events, HEUTE, 10, 'hand'), [], '--wer hand: nichts')
assert.equal(nextTop({ zeilen: [zeile(99, 'cover', 3, 'daniel')] }, titel, events, HEUTE, 5)[0].name, '?', 'Titel ohne Eintrag in titles.json: Name „?“')

/* laufend: Film nie, Altbestand ohne Ende nach Jahr, neue Serie ohne Ende ja (Echtformen: Zorro, 10009970, Ranma S3). */
assert.equal(laeuft({ format: 'MOVIE' }, HEUTE), false, 'Film ohne jpEnd')
assert.equal(laeuft({ format: 'TV', jpYear: 1977 }, HEUTE), false, 'Altbestand 1977 ohne jpEnd')
assert.equal(laeuft({ format: 'TV', jpYear: 2026 }, HEUTE), true, 'Serie 2026 ohne jpEnd')
assert.equal(laeuft({ format: 'TV' }, HEUTE), true, 'ohne jedes Jahr: unbekannt gilt als laufend wie bisher')

/* Übersicht: Wirkung und wer stammen aus dem Zähler, auch bei Arten ohne offene Zeile. */
const zeilenUebersicht = uebersicht({
  stand: HEUTE,
  zaehler: {
    fsk: { wirkung: 2, wer: 'auto:justwatch', offen: 5, neu: 1, behoben: 2, rueckfall: 0, ausnahme: 3 },
    banner: { wirkung: 1, wer: 'auto:tmdb-banner', offen: 0, neu: 0, behoben: 0, rueckfall: 0, ausnahme: 0 },
  },
  zeilen: [],
  hinweis: 'Vorfassung kaputt',
})
assert.equal(zeilenUebersicht[0], `Mängel am ${HEUTE}`)
assert.match(zeilenUebersicht.find((z) => z.startsWith('fsk')), /fsk +5 +1 +2 +0 +3 +W2 +auto:justwatch$/, 'Zahlen, Wirkung und wer der Art')
assert.match(zeilenUebersicht.find((z) => z.startsWith('banner')), /banner +0 +0 +0 +0 +0 +W1 +auto:tmdb-banner$/, 'Art ohne offene Zeile zeigt Wirkung und wer')
assert.equal(zeilenUebersicht.at(-1), 'Hinweis: Vorfassung kaputt', 'Hinweis des Baus steht am Ende')
console.log('maengel: ok')
