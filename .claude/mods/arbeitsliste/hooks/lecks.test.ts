import { test, expect } from 'claude-code/testing'

import { lecksText, zaehleLecks } from './lecks'

test('zaehleLecks: ohne Bericht nur der Zähler, mit Bericht Urteil und Tooltip', () => {
  const vor = zaehleLecks('{"seitBericht":3,"letzterBericht":null}')
  expect(vor?.n).toBe(3)
  expect(vor?.urteil).toBe(null)
  expect(lecksText(vor!)).toBe('Lecks 3/5')
  const sauber = zaehleLecks('{"seitBericht":0,"letzterBericht":{"zeit":"2026-10-11T11:00:00Z","leck":false,"waisen":0}}')
  expect(lecksText(sauber!)).toBe('Lecks 0/5 ✓')
  expect(sauber?.tooltip).toMatch(/Letzter Bericht 11\.10\., \d\d:\d\d: sauber, 0 Waisen/)
  const leck = zaehleLecks('{"seitBericht":2,"letzterBericht":{"zeit":"2026-10-11T11:00:00Z","leck":true,"waisen":2}}')
  expect(lecksText(leck!)).toBe('Lecks 2/5 ⚠')
})

test('zaehleLecks: Zähler wird auf 0–4 begrenzt, kaputte Datei zeigt nichts', () => {
  expect(zaehleLecks('{"seitBericht":9}')?.n).toBe(4)
  expect(zaehleLecks('{"seitBericht":-1}')?.n).toBe(0)
  expect(zaehleLecks('kein json')).toBe(null)
})
