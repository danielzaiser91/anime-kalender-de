// Zusicherung: „heute“ ist der Berliner Tag. Um 00:30 Berliner Zeit ist es in UTC noch gestern; die alte Form
// `new Date().toISOString().slice(0, 10)` lieferte dann den Vortag (tools/heute-utc.mjs hält sie draußen).
import assert from 'node:assert/strict'
import { todayIso } from '../shared/time.ts'
import { favoritDatumPflegen, favoritSeit } from '../web/src/lib/favorites.ts'
import { festeUhr } from './feste-uhr.ts'

const speicher = new Map<string, string>()
const lokal = {
  getItem: (k: string) => speicher.get(k) ?? null,
  setItem: (k: string, v: string) => void speicher.set(k, v),
}
Object.assign(globalThis, { localStorage: lokal })

// [Zeitpunkt, Berliner Tag, UTC-Tag]: Sommerzeit, Winterzeit mit Jahreswechsel, und mittags ohne Unterschied.
const faelle: [string, string, string][] = [
  ['2026-10-20T22:30:00Z', '2026-10-21', '2026-10-20'],
  ['2026-12-31T23:30:00Z', '2027-01-01', '2026-12-31'],
  ['2026-10-21T12:00:00Z', '2026-10-21', '2026-10-21'],
]

for (const [zeitpunkt, berlin, utc] of faelle) {
  const zurueck = festeUhr(zeitpunkt)
  try {
    assert.equal(new Date(zeitpunkt).toISOString().slice(0, 10), utc, `${zeitpunkt}: der UTC-Tag weicht wie erwartet ab (Voraussetzung der Probe)`)
    assert.equal(todayIso(), berlin, `${zeitpunkt}: todayIso() ist der Berliner Tag`)
    speicher.clear()
    favoritDatumPflegen(7, true)
    assert.equal(favoritSeit(7), berlin, `${zeitpunkt}: „gemerkt seit“ trägt den Berliner Tag`)
  } finally {
    zurueck()
  }
}
console.log('Alle Prüfungen grün.')
