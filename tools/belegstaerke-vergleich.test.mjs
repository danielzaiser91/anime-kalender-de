// Prüft Summen je Stufe, Namenswahl und neue/entfallene Titel des Belegstärke-Vergleichs mit zwei synthetischen Ständen.
import assert from 'node:assert/strict'
import { formatiere, vergleicheStaerke } from './belegstaerke-vergleich.mjs'

const alt = [
  { id: 1, titleDe: 'Eins', dubConfidence: 'low' },
  { id: 2, titleEn: 'Two', dubConfidence: 'high' },
  { id: 3, titleRomaji: 'San', dubConfidence: 'normal' },
  { id: 4, dubConfidence: 'high' },
]
const neu = [
  { id: 2, titleEn: 'Two', dubConfidence: 'high' },
  { id: 1, titleDe: 'Eins', dubConfidence: 'very-high' },
  { id: 3, titleRomaji: 'San', dubConfidence: 'low' },
  { id: 5, titleDe: 'Fünf', dubConfidence: 'normal' },
]
const e = vergleicheStaerke(alt, neu)
assert.deepEqual([e.alt.low, e.alt.normal, e.alt.high, e.alt['very-high'], e.alt.fehlt], [1, 1, 2, 0, 0])
assert.deepEqual([e.neu.low, e.neu.normal, e.neu.high, e.neu['very-high']], [1, 1, 1, 1])
assert.deepEqual(e.aenderungen.map((c) => `${c.id}:${c.name}:${c.von}>${c.nach}`).sort(), [
  '1:Eins:low>very-high', '3:San:normal>low', '4:undefined:high>fehlt', '5:Fünf:fehlt>normal',
])
const text = formatiere(e)
assert.match(text, /^1 \(Eins\): low → very-high$/m)
assert.match(text, /^4: high → fehlt$/m)
assert.match(text, /4 Titel geändert/)
assert.equal(vergleicheStaerke(alt, structuredClone(alt)).aenderungen.length, 0)
console.log('belegstaerke-vergleich: 7 Fälle ok')
