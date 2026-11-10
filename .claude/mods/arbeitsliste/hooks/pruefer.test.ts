import { test, expect } from 'claude-code/testing'

import { agentenText, istPruefer } from './pruefer'

test('istPruefer: Typ pruefer oder Beschreibung beginnt mit Prüfer', () => {
  expect(istPruefer({ description: 'Prüfer PR 12' })).toBe(true)
  expect(istPruefer({ description: '  prüfer: Diff' })).toBe(true)
  expect(istPruefer({ type: 'pruefer', description: 'Gegenlesen' })).toBe(true)
  expect(istPruefer({ description: 'Bauer für Prüfer-Tests' })).toBe(false)
})

test('agentenText: mit Prüfern „a+p“, ohne Prüfer nur die Zahl', () => {
  expect(agentenText(0, 2)).toBe('Agents 0+2')
  expect(agentenText(3, 1)).toBe('Agents 3+1')
  expect(agentenText(3, 0)).toBe('Agents 3')
  expect(agentenText(0, 0)).toBe('Agents 0')
})
