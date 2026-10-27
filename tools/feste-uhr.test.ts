/**
 * Gegenprobe zu tools/feste-uhr.ts: Argumente werden durchgereicht, `Date()` ohne new liefert den festen Zeitpunkt,
 * `instanceof Date` und die Rückgabefunktion stimmen.
 *
 * Aufruf: `npx tsx tools/feste-uhr.test.ts`
 */
import assert from 'node:assert/strict'
import { festeUhr } from './feste-uhr.ts'

const Echt = globalThis.Date // uhr-echt: sichert das echte Date zum Zurückstellen, liest keine Zeit
const zurueck = festeUhr('2026-10-12T12:00:00Z')
try {
  assert.equal(new Date().toISOString(), '2026-10-12T12:00:00.000Z', 'ohne Argument: fester Zeitpunkt') // uhr-echt: prüft gerade die feste Uhr
  assert.equal(Date.now(), Echt.parse('2026-10-12T12:00:00Z'), 'Date.now fest') // uhr-echt: prüft gerade die feste Uhr
  assert.equal(new Date(2026, 9, 12).getFullYear(), 2026, 'Jahr, Monat, Tag werden durchgereicht')
  assert.equal(new Date(2026, 9, 12).getMonth(), 9)
  assert.equal(new Date(Date.UTC(2026, 9, 12, 1)).toISOString(), '2026-10-12T01:00:00.000Z', 'Date.UTC bleibt echt')
  assert.equal(new Date('2020-01-02T03:04:05Z').toISOString(), '2020-01-02T03:04:05.000Z', 'Text-Argument')
  assert.equal(new Date(0).toISOString(), '1970-01-01T00:00:00.000Z', 'Argument 0 ist kein „kein Argument“')
  assert.equal(typeof Date(), 'string', 'Date() ohne new wirft nicht') // uhr-echt: prüft gerade die feste Uhr
  assert.equal(Date(), new Echt('2026-10-12T12:00:00Z').toString(), 'Date() liefert den festen Zeitpunkt') // uhr-echt: prüft gerade die feste Uhr
  assert.ok(new Date() instanceof Date, 'instanceof Date') // uhr-echt: prüft gerade die feste Uhr
  assert.ok(new Date() instanceof Echt, 'auch gegen das echte Date') // uhr-echt: prüft gerade die feste Uhr
} finally {
  zurueck()
}
assert.equal(globalThis.Date, Echt, 'Rückgabefunktion stellt das echte Date wieder her')
console.log('Alle Prüfungen grün.')
