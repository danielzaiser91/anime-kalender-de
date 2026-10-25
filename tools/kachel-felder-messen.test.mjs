/**
 * Einheitenfälle für `tools/kachel-felder-messen.mjs` ohne Browser: welche gelesenen Pfade als „aus der Kachel-Datei abgezogen“ gelten
 * und welche Wochen die Probe misst. Erwartete Pfade stehen fest hier, nicht aus den Abzugslisten geholt.
 */
import assert from 'node:assert/strict'
import { verlorene, wochenTage } from './kachel-felder-messen.mjs'

const gelesen = [
  'title.titleDe',
  'title.coverImage',
  'title.streams',
  'title.streams.url',
  'title.streams.dub',
  'title.watchLinks.toggo',
  'title.watchLinks.name',
  'release.sources',
  'release.sources.0',
  'release.schedule',
  'release.schedule.observed',
  'release.platformUrl',
  'event.titleId',
  'event.name',
  'title.titleDe#keys',
]
assert.deepEqual(verlorene(gelesen), ['title.titleDe', 'title.streams.url', 'title.watchLinks.toggo', 'release.sources', 'release.sources.0', 'release.platformUrl'])
assert.deepEqual(verlorene(['title.coverImage', 'release.schedule', 'title.streams']), [], 'nur gelesene, nicht abgezogene Felder: nichts verloren')
assert.deepEqual(verlorene([]), [])
/* Ein Feld gleichen Namens auf einem anderen Typ ist kein Verlust: `url` steht bei Titeln nicht auf der Liste, bei Wegen schon. */
assert.deepEqual(verlorene(['title.url', 'release.url', 'event.sources']), [])

assert.deepEqual(wochenTage('2026-10-19'), ['2026-10-19', '2026-10-05', '2026-09-07'])
assert.deepEqual(wochenTage('2027-01-04'), ['2027-01-04', '2026-12-21', '2026-11-23'], 'über den Jahreswechsel')
assert.deepEqual(wochenTage('2026-03-30'), ['2026-03-30', '2026-03-16', '2026-02-16'], 'über die Zeitumstellung')

console.log('kachel-felder-messen.test: ok (verlorene Pfade, Wochenwahl)')
