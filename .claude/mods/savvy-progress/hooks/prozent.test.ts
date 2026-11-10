import { test, expect } from 'claude-code/testing'

import { agentenGesamt, schrittZahl, stepStand } from './prozent'
import type { AgentRun } from '../types'

const lauf = (status: AgentRun['status'], rest: Partial<AgentRun> = {}): AgentRun =>
  ({ id: 'x', type: 't', description: '', model: 'm', status, startedAt: 0, contextTokens: 0, contextMax: 0, steps: 0, round: 1, ...rest }) as AgentRun

test('stepStand: erster Aufruf mit steps und percent 0, danach kumuliert; Summe wird auf 100 gebracht', () => {
  const a = stepStand({}, { steps: [{ name: 'lesen', percent: 10 }, { name: 'bauen', percent: 80 }, { name: 'PR', percent: 2 }], percent: 0 })
  expect(a.stepPercent).toBe(0)
  expect(a.stepPlan?.map(s => Math.round(s.percent))).toEqual([11, 87, 2])
  expect(schrittZahl(a)).toEqual({ done: 0, total: 3 })
  const b = stepStand(a, { percent: 98 })
  expect(b.stepPlan).toBe(a.stepPlan)
  expect(schrittZahl(b)).toEqual({ done: 2, total: 3 })
  expect(schrittZahl(stepStand(b, { percent: 150 }))).toEqual({ done: 3, total: 3 })
})

test('stepStand: Rückfall done/total wird zu gleich großen Schritten und Prozent', () => {
  const a = stepStand({}, { done: 0, total: 4 })
  expect(a.stepPercent).toBe(0)
  const b = stepStand(a, { done: 3 })
  expect(b.stepPercent).toBe(75)
  expect(schrittZahl(b)).toEqual({ done: 3, total: 4 })
})

test('agentenGesamt: nur laufende; Agent ohne Meldung zählt 0 %; ohne Laufende null', () => {
  const a = lauf('running', stepStand({}, { steps: [{ name: 'a', percent: 50 }, { name: 'b', percent: 50 }], percent: 50 }))
  const b = lauf('running')
  const fertig = lauf('done', { stepPercent: 100, stepPlan: [{ name: 'a', percent: 100 }] })
  const g = agentenGesamt([a, b, fertig])
  expect(g).toEqual({ done: 1, total: 2, percent: 25 })
  expect(agentenGesamt([fertig])).toBeNull()
})
