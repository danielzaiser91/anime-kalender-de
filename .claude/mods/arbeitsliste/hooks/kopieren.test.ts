import { test, expect } from 'claude-code/testing'

import { kopierText } from './kopieren'

test('kopierText: Titel, Rest und Verweise zeilenweise, Leeres entfällt', () => {
  const links = [{ label: 'Bericht', href: 'file:///C:/a.md', pfad: 'C:/a.md' }]
  expect(kopierText({ titel: 'T', rest: 'R', links })).toBe('T\nR\nBericht: file:///C:/a.md')
  expect(kopierText({ titel: 'T', rest: '', links: [] })).toBe('T')
})
