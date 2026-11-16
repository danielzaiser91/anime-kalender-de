import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mischeZeilen, pruefeKontingent, tagNachLetzterZeile } from './tageskennzahlen-anhaengen.mjs'

const z = (tag, merges = 0) => JSON.stringify({ tag, merges })

test('mischen: Altes bleibt, gleicher Tag wird ersetzt, Neues wird einsortiert', () => {
  const alt = `${z('2026-11-12', 1)}\n${z('2026-11-14', 2)}\n`
  const r = mischeZeilen(alt, [z('2026-11-13', 5), z('2026-11-14', 9), z('2026-11-15', 7)])
  assert.deepEqual(r.map((x) => JSON.parse(x)), [{ tag: '2026-11-12', merges: 1 }, { tag: '2026-11-13', merges: 5 }, { tag: '2026-11-14', merges: 9 }, { tag: '2026-11-15', merges: 7 }])
})

test('Tag nach der letzten Zeile, leere Datei nimmt die Vorgabe', () => {
  assert.equal(tagNachLetzterZeile(`${z('2026-11-30')}\n${z('2026-11-14')}\n`, 'x'), '2026-12-01')
  assert.equal(tagNachLetzterZeile('', '2026-10-01'), '2026-10-01')
})

test('Kontingent: zu klein bricht ab, ausreichend nicht', () => {
  assert.throws(() => pruefeKontingent(1000, 46), /Kontingent zu klein: 1000/)
  assert.doesNotThrow(() => pruefeKontingent(5000, 1))
})
