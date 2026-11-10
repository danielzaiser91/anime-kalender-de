import { test, expect } from 'claude-code/testing'

import { crewText } from './crew'

const lauf = (running: number, done: number, failed = 0) => [
  ...Array(running).fill('running'),
  ...Array(done).fill('done'),
  ...Array(failed).fill('failed'),
]

test('crewText: 50 Läufe, 39 fertig, 9 aktiv, 2 geplant → „9 + 2“', () => {
  expect(crewText(lauf(9, 39, 2), 2)).toBe('9 + 2')
})

test('crewText: nur aktive, nur geplante, nichts', () => {
  expect(crewText(lauf(9, 39), 0)).toBe('9')
  expect(crewText(lauf(0, 39), 2)).toBe('0 + 2')
  expect(crewText(lauf(0, 39), 0)).toBe('')
})
