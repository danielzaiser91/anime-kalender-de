/**
 * Einheitenfälle für `tools/kachel-felder-messen.mjs` ohne Browser: welche gelesenen Pfade als „aus der Kachel-Datei abgezogen“ gelten
 * und welche Wochen die Probe misst. Erwartete Pfade stehen fest hier, nicht aus den Abzugslisten geholt.
 */
import assert from 'node:assert/strict'
import { PROXY, verlorene, wochenTage } from './kachel-felder-messen.mjs'

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

/* Sendungen behalten `start` und `ende`: jedes andere gelesene Feld ist ein Verlust. */
assert.deepEqual(verlorene(['release.sendungen', 'release.sendungen.start', 'release.sendungen.ende', 'release.sendungen.sender.name']), ['release.sendungen.sender.name'])

/* Lesezugriffe über `in` und `hasOwnProperty` zählen wie `get`; Listen-Indizes nicht. */
function gelesenNach(lesen) {
  const fenster = { Response: { prototype: { json: async () => ({}) } } }
  new Function('window', 'Response', `${PROXY}; window.__proxy = umhuelle`)(fenster, fenster.Response)
  lesen(fenster.__proxy({ sendungen: [{ start: 1, ende: 2 }], titel: 'x' }, 'release'))
  return Object.keys(fenster.__gelesen).sort()
}
assert.deepEqual(gelesenNach((o) => 'titel' in o), ['release.titel'], 'in')
assert.deepEqual(gelesenNach((o) => Object.prototype.hasOwnProperty.call(o, 'fehlt')), ['release.fehlt'], 'hasOwnProperty')
assert.deepEqual(gelesenNach((o) => Object.hasOwn(o.sendungen[0], 'ende')), ['release.sendungen', 'release.sendungen.ende'], 'hasOwn in Sendung')
assert.deepEqual(gelesenNach((o) => 0 in o.sendungen), ['release.sendungen'], 'Listen-Index zählt nicht')

assert.deepEqual(wochenTage('2026-10-19'), ['2026-10-19', '2026-10-05', '2026-09-07'])
assert.deepEqual(wochenTage('2027-01-04'), ['2027-01-04', '2026-12-21', '2026-11-23'], 'über den Jahreswechsel')
assert.deepEqual(wochenTage('2026-03-30'), ['2026-03-30', '2026-03-16', '2026-02-16'], 'über die Zeitumstellung')

console.log('kachel-felder-messen.test: ok (verlorene Pfade, Wochenwahl)')
