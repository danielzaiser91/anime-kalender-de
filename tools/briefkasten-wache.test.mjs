// Prüft die Wache-Entscheidung: nur eine ungelistete Adresse mit alter Meldung ist ein Befund.
import assert from 'node:assert/strict'
import { liegengeblieben } from './briefkasten-wache-logik.mjs'

const JETZT = Date.parse('2026-10-11T12:00:00Z')
const meldung = (url, gemeldet_am) => ({ url, gemeldet_am })
const meldungen = [
  meldung('https://x/jung', '2026-10-11T08:00:00Z'),
  meldung('https://x/alt', '2026-10-10T08:00:00Z'),
  meldung('https://x/gemischt', '2026-10-11T09:00:00Z'),
  meldung('https://x/gemischt', '2026-10-01T09:00:00Z'),
]
const befund = (fehlend, liste = meldungen) => liegengeblieben(fehlend, liste, JETZT, 24)

assert.deepEqual(befund(['https://x/jung']), [], 'junge Meldung ist ein Nachzügler')
assert.deepEqual(befund(['https://x/alt']), ['https://x/alt'], 'Meldung über 24 h ist liegengeblieben')
assert.deepEqual(befund(['https://x/gemischt']), ['https://x/gemischt'], 'die älteste Meldung der Adresse entscheidet')
assert.deepEqual(befund(['https://x/fehlt']), [], 'Adresse ohne bekanntes Alter ist kein Befund')
assert.deepEqual(befund(['https://x/alt'], []), [], 'leere Antwort ist kein Befund')
assert.deepEqual(befund([]), [], 'nichts ungelistet')
console.log('briefkasten-wache.test: 6 Fälle grün.')
