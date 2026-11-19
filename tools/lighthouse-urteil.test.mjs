/** Test des Lighthouse-Urteils (`lighthouse-urteil.mjs`): Kennzahlen aus dem Bericht, Median, Grenzen in beide Richtungen, Ratsche. */
import assert from 'node:assert/strict'
import { GRENZEN, SEITEN } from './lighthouse-grenzen.mjs'
import { gelockert, groessteAnfragen, kennzahlen, mediane, tabelle, verstoesse } from './lighthouse-urteil.mjs'

const bericht = {
  audits: { 'largest-contentful-paint': { numericValue: 923.4 }, 'cumulative-layout-shift': { numericValue: 0.00123 }, 'total-blocking-time': { numericValue: 93.2 }, 'total-byte-weight': { numericValue: 198145 } },
  categories: { performance: { score: 0.99 }, accessibility: { score: 0.96 }, 'best-practices': { score: 0.96 }, seo: { score: 1 } },
}
const k = kennzahlen(bericht)
assert.deepEqual(k, { lcp: 923, cls: 0.001, tbt: 93, bytes: 198145, performance: 99, accessibility: 96, 'best-practices': 96, seo: 100, benchmark: 0 }, 'Kennzahlen aus dem Bericht')
assert.equal(kennzahlen({ ...bericht, environment: { benchmarkIndex: 1834.6 } }).benchmark, 1835, 'Rechnergeschwindigkeit mitgeschrieben')
assert.equal(kennzahlen({ ...bericht, categories: { ...bericht.categories, seo: { score: null } } }).seo, undefined, 'Kategorie ohne Punkte bleibt leer')

assert.equal(mediane([{ ...k, lcp: 900 }, { ...k, lcp: 5000 }, { ...k, lcp: 1000 }]).lcp, 1000, 'Median, nicht Mittel: ein Ausreißer zählt nicht')

const dreiBytes = (a, b, c) => mediane([a, b, c].map((bytes) => ({ ...k, bytes }))).bytes
const bytesVerstoss = (bytes) => verstoesse('Titel', { ...k, bytes }, GRENZEN.pr.Titel).filter((v) => /bytes/.test(v))
assert.equal(dreiBytes(4698189, 4040380, 3415434), 3415434, 'Bytes: Minimum, nicht Median (PR 4317, Lauf 44590780116)')
assert.deepEqual(bytesVerstoss(dreiBytes(4698189, 4040380, 3415434)), [], 'Minimum unter 3 800 000: grün')
assert.deepEqual(bytesVerstoss(dreiBytes(4698189, 4040380, 3900000)), ['Titel: bytes 3900000 > 3800000'], 'alle drei über der Grenze: rot')

const items = [{ url: 'a', transferSize: 10 }, { url: 'b', transferSize: 300 }, { url: 'c' }, { url: 'd', transferSize: 20 }]
assert.deepEqual(groessteAnfragen({ audits: { 'network-requests': { details: { items } } } }, 2), [{ url: 'b', bytes: 300 }, { url: 'd', bytes: 20 }], 'Anfragen nach Größe, gekürzt, ohne Größe weggelassen')
assert.deepEqual(groessteAnfragen(bericht), [], 'ohne Anfrageliste: leer')

const g = { lcp: 1000, cls: 0.1, tbt: 200, bytes: 200000, performance: 95, accessibility: 96, 'best-practices': 96, seo: 100 }
assert.deepEqual(verstoesse('Kalender', k, g), [], 'auf und unter den Grenzen: grün')
assert.deepEqual(verstoesse('Kalender', { ...k, lcp: 1001 }, g), ['Kalender: lcp 1001 > 1000'], 'Obergrenze 1 ms überschritten: rot')
assert.deepEqual(verstoesse('Kalender', { ...k, performance: 94 }, g), ['Kalender: performance 94 < 95'], 'Untergrenze 1 Punkt unterschritten: rot')
assert.equal(verstoesse('Kalender', { ...k, seo: undefined }, g).length, 1, 'nicht gemessen: rot')
assert.equal(verstoesse('Kalender', k, { ...g, tbt: undefined }).length, 1, 'Grenze fehlt: rot')
assert.equal(verstoesse('Kalender', k, undefined).length, 1, 'Seite ohne Grenzen: rot')

const alt = { pr: { Kalender: g } }
assert.deepEqual(gelockert(alt, alt), [], 'unverändert: keine Lockerung')
assert.deepEqual(gelockert({ pr: { Kalender: { ...g, performance: 96, lcp: 900 } } }, alt), [], 'strenger: erlaubt')
assert.deepEqual(gelockert({ pr: { Kalender: { ...g, performance: 94 } } }, alt), ['pr/Kalender/performance: 95 → 94'], 'Kategorie gesenkt: rot')
assert.deepEqual(gelockert({ pr: { Kalender: { ...g, bytes: 200001 } } }, alt), ['pr/Kalender/bytes: 200000 → 200001'], 'Byte-Grenze angehoben: rot')
assert.equal(gelockert({ pr: {} }, alt).length, 8, 'Seite entfernt: jede Grenze zählt')
assert.deepEqual(gelockert(alt, null), [], 'ohne Basis (Datei neu): keine Prüfung')

assert.match(tabelle({ Kalender: k }, { Kalender: g }), /\| Kalender \| 923 \(≤ 1000\) .* 194 KB \(≤ 195 KB\)/, 'Tabelle mit Grenze je Zelle')

for (const profil of ['pr', 'live']) {
  for (const seite of Object.keys(SEITEN)) assert.deepEqual(verstoesse(seite, { ...k, lcp: 0, tbt: 0, bytes: 0, cls: 0, performance: 100, accessibility: 100, 'best-practices': 100, seo: 100 }, GRENZEN[profil][seite]), [], `${profil}/${seite}: jede Grenze gesetzt`)
}
console.log('lighthouse-urteil: 24 Fälle ✓')
