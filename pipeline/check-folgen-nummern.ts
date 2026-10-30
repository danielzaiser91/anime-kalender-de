/**
 * Eine Nummer, eine Zeile (30.10.2026): Zeilen aus `data/anisearch-folgen.json` wörtlich (aniSearch 17808, 3663, 16205, 17327).
 * Ergänzende Zeilen werden eine, widersprechende (echte Doppelungen) bleiben beide; der Bestandswächter kennt nur die vermerkten.
 */
import assert from 'node:assert/strict'
import { doppelteNummern, eineZeileJeNummer, unerlaubteDoppelte, type NummernFolge } from './bau/folgen-nummern.ts'

const siebenSchatten: NummernFolge[] = [
  { nr: 1, datum: '2022-10-27', minuten: 2, ja: 'Operation 1: Shichi Kage wa Sakusen o Seikou Sasetai! (オペレーション.1「七陰は作戦を成功させたい!」)' },
  { nr: 1, minuten: 2, de: 'Operation 1: Schattenwahrheiten! Die Sieben Schatten wollen ihren Auftrag erfüllen!' },
  { nr: 2, minuten: 2, de: 'Operation 2: Schattenwahrheiten! Die Sieben Schatten wollen eine schöne Kriegsgeschichte!' },
]
const a = eineZeileJeNummer(siebenSchatten)
assert.equal(a.verschmolzen, 1)
assert.deepEqual(a.folgen.map((x) => x.nr), [1, 2])
assert.equal(a.folgen[0].datum, '2022-10-27')
assert.match(a.folgen[0].de ?? '', /^Operation 1: Schattenwahrheiten/)
assert.match(a.folgen[0].ja ?? '', /^Operation 1: Shichi Kage/)

/* Zweite Zeile ohne Titel (1575, Folge 8): Datum und Titel der ersten bleiben, die Zeile entfällt. */
const ritter: NummernFolge[] = [
  { nr: 8, datum: '2006-11-24', minuten: 24, de: 'Die Schwarzen Ritter', en: 'The Black Knights' },
  { nr: 8, minuten: 24 },
]
const b = eineZeileJeNummer(ritter)
assert.deepEqual([b.folgen.length, b.verschmolzen, b.folgen[0].de], [1, 1, 'Die Schwarzen Ritter'])
/* Reihenfolge der Zeilen gleich: die ergänzende Zeile zuerst. */
assert.equal(eineZeileJeNummer([...ritter].reverse()).folgen[0].datum, '2006-11-24')

/* Echte Doppelungen: Teil 1 und Teil 2 (17327) mit eigenem Datum, Titel und Minuten bleiben beide. */
const teile: NummernFolge[] = [
  { nr: 13, datum: '2022-06-24', minuten: 15, de: 'Verliere bei der Trainingsreise nicht das Ziel aus den Augen (Teil 1)' },
  { nr: 13, datum: '2022-08-24', minuten: 9, de: 'Verliere bei der Trainingsreise nicht das Ziel aus den Augen (Teil 2)' },
]
const c = eineZeileJeNummer(teile)
assert.deepEqual([c.folgen.length, c.verschmolzen], [2, 0])
/* Nur der Titel widerspricht (16205, Folge 10 zweimal ausgestrahlt, gleiche Minuten). */
const d = eineZeileJeNummer([
  { nr: 10, datum: '2021-12-26', minuten: 24, de: 'Alles, was übrig ist' },
  { nr: 10, datum: '2022-03-05', minuten: 24, de: 'Ich will wenigstens ein Mensch sein' },
])
assert.deepEqual([d.folgen.length, d.verschmolzen], [2, 0])
/* Drei Zeilen: die dritte passt nur zur zweiten. */
const e = eineZeileJeNummer([
  { nr: 5, de: 'A' },
  { nr: 5, de: 'B' },
  { nr: 5, minuten: 24, de: 'B' },
])
assert.deepEqual([e.folgen.length, e.verschmolzen, e.folgen[1].minuten], [2, 1, 24])
/* Eindeutig und leer bleiben gleich. */
assert.deepEqual(eineZeileJeNummer([{ nr: 1 }, { nr: 2 }]), { folgen: [{ nr: 1 }, { nr: 2 }], verschmolzen: 0 })
assert.deepEqual(eineZeileJeNummer([]), { folgen: [], verschmolzen: 0 })

/* Wächter-Regel: doppelt → gemeldet, eindeutig → nicht, vermerkte echte Doppelung → erlaubt, aber nur für ihren Titel und ihre Nummer. */
assert.deepEqual(doppelteNummern([1, 2, 3, 3, 4, 4, 4]), [3, 4])
assert.deepEqual(doppelteNummern([1, 2, 3]), [])
assert.deepEqual(unerlaubteDoppelte(999999, [1, 2, 2]), [2])
assert.deepEqual(unerlaubteDoppelte(131586, [9, 10, 10, 11]), [])
assert.deepEqual(unerlaubteDoppelte(131586, [9, 10, 10, 11, 11]), [11])
assert.deepEqual(unerlaubteDoppelte(151126, [10, 10]), [10])
assert.deepEqual(unerlaubteDoppelte(131586, [13, 13]), [13])

console.log('check-folgen-nummern: ok (Zusammenführen, echte Doppelungen, Wächter-Regel)')
