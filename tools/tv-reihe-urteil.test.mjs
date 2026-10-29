/**
 * Test: Urteilsregeln der TV-Wischreihe aus festen Messwerten.
 * Aufruf: node tools/tv-reihe-urteil.test.mjs
 */
import assert from 'node:assert/strict'
import { urteilReihe, urteilTastatur, urteilRand, tvKulisse } from './tv-reihe-urteil.mjs'

const gut = { oben: [10, 10, 10.5], scrollBreite: 360, fensterBreite: 360, minKnopf: 44, reiheScrollt: true }
assert.deepEqual(urteilReihe(gut), [])
assert.equal(urteilReihe({ ...gut, oben: [10, 60, 110] }).length, 1, 'untereinander')
assert.equal(urteilReihe({ ...gut, oben: [10, 11] }).length, 0, 'Spanne genau 1 ist noch eine Reihe')
assert.equal(urteilReihe({ ...gut, oben: [10, 12] }).length, 1, 'Spanne 2 ist keine Reihe')
assert.equal(urteilReihe({ ...gut, oben: [10] }).length, 1, 'eine Kachel reicht nicht als Messung')
assert.equal(urteilReihe({ ...gut, reiheScrollt: false }).length, 1)
assert.equal(urteilReihe({ ...gut, scrollBreite: 361 }).length, 1, 'ein Pixel Überlauf')
assert.equal(urteilReihe({ ...gut, scrollBreite: 2718 }).length, 1, 'sr-only-Überlauf')
assert.equal(urteilReihe({ ...gut, minKnopf: 43.5 }).length, 1)
assert.equal(urteilReihe({ ...gut, minKnopf: 43.95 }).length, 0)

const tab = { fokusAufVerdeckter: true, scrollVorher: 0, scrollNachher: 120, sichtbar: true }
assert.deepEqual(urteilTastatur(tab), [])
assert.equal(urteilTastatur({ ...tab, fokusAufVerdeckter: false }).length, 1)
assert.equal(urteilTastatur({ ...tab, scrollNachher: 0 }).length, 1)
assert.equal(urteilTastatur({ ...tab, scrollNachher: 1 }).length, 0)
assert.equal(urteilTastatur({ ...tab, sichtbar: false }).length, 1)

const grund = [20, 30, 40]
const rand = [60, 120, 110]
const r = { grund, rand, ecke: [22, 31, 40], darunter: [grund, [21, 30, 41], grund] }
assert.deepEqual(urteilRand(r), [])
assert.equal(urteilRand({ ...r, rand: grund }).length, 1, 'Kante abgeschnitten')
assert.equal(urteilRand({ ...r, ecke: rand }).length, 1, 'eckig')
assert.equal(urteilRand({ ...r, darunter: [grund, rand, grund] }).length, 1, 'Rest in der zweiten Zeile')
assert.equal(urteilRand({ ...r, darunter: [rand, rand, rand] }).length, 3)

const events = [{ releaseSlug: 'a', platform: 'netflix', date: '2026-01-01' }, { releaseSlug: 'b', platform: 'tv', sender: 'X', date: '2026-01-02', time: '10:00' }]
const k = tvKulisse(events, '2026-02-02', 12)
const neu = k.slice(2)
assert.equal(neu.length, 12)
assert.equal(new Set(neu.map((e) => e.sender)).size, 12, 'je Sender verschieden')
assert.equal(new Set(neu.map((e) => e.id)).size, 12)
assert.ok(neu.every((e) => e.platform === 'tv' && e.date === '2026-02-02' && e.releaseSlug === 'b'))
assert.equal(tvKulisse([], '2026-02-02', 3).length, 0)
console.log('tv-reihe-urteil: ok (Reihe 10, Tastatur 5, Rand 5, Kulisse 5 Fälle)')
