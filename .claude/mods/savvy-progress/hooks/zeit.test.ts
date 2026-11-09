import { test, expect } from 'claude-code/testing'

import { schaetzungText, zeitStatus } from './zeit'

const min = (m: number) => m * 60_000

test('zeitStatus: Schwellen bei 10 Minuten Schätzung (89 % / 90 % / 100 % / 101 %)', () => {
  expect(zeitStatus(min(8.9), 10)).toBe('ok')
  expect(zeitStatus(min(9), 10)).toBe('warn')
  expect(zeitStatus(min(10), 10)).toBe('warn')
  expect(zeitStatus(min(10.1), 10)).toBe('over')
})

test('zeitStatus: ohne Schätzung oder mit 0 Minuten keine Wertung', () => {
  expect(zeitStatus(min(5), undefined)).toBeNull()
  expect(zeitStatus(min(5), 0)).toBeNull()
  expect(zeitStatus(min(5), -3)).toBeNull()
  expect(zeitStatus(min(5), Number.NaN)).toBeNull()
})

test('schaetzungText: ganze Minuten', () => {
  expect(schaetzungText(15)).toBe('~15 min')
  expect(schaetzungText(7.6)).toBe('~8 min')
})
