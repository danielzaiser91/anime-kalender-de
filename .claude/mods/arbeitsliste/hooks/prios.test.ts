import { test, expect } from 'claude-code/testing'

import { zeichenJeSpalte } from './prios'

test('zeichenJeSpalte: Terminal 1, Desktop 1,6', () => {
  expect(zeichenJeSpalte('terminal')).toBe(1)
  expect(zeichenJeSpalte('desktop')).toBe(1.6)
})
