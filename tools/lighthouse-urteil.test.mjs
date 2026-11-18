/** Test des Lighthouse-Urteils (`lighthouse-urteil.mjs`): Kennzahlen aus dem Bericht, Median, Grenzen in beide Richtungen, Ratsche. */
import assert from 'node:assert/strict'
import { GRENZEN, SEITEN } from './lighthouse-grenzen.mjs'
import { gelockert, kennzahlen, mediane, tabelle, verstoesse } from './lighthouse-urteil.mjs'

const bericht = {
  audits: { 'largest-contentful-paint': { numericValue: 923.4 }, 'cumulative-layout-shift': { numericValue: 0.00123 }, 'total-blocking-time': { numericValue: 93.2 }, 'total-byte-weight': { numericValue: 198145 } },
  categories: { performance: { score: 0.99 }, accessibility: { score: 0.96 }, 'best-practices': { score: 0.96 }, seo: { score: 1 } },
}
const k = kennzahlen(bericht)
assert.deepEqual(k, { lcp: 923, cls: 0.001, tbt: 93, bytes: 198145, performance: 99, accessibility: 96, 'best-practices': 96, seo: 100 }, 'Kennzahlen aus dem Bericht')
assert.equal(kennzahlen({ ...bericht, categories: { ...bericht.categories, seo: { score: null } } }).seo, undefined, 'Kategorie ohne Punkte bleibt leer')

assert.equal(mediane([{ ...k, lcp: 900 }, { ...k, lcp: 5000 }, { ...k, lcp: 1000 }]).lcp, 1000, 'Median, nicht Mittel: ein Ausreißer zählt nicht')

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
console.log('lighthouse-urteil: 18 Fälle ✓')
