import { test, expect } from 'claude-code/testing'

import { gleicheAb } from './abgleich'
import type { AgentRun } from '../types'

const lauf = (agentId: string, startedAt: number, status: AgentRun['status'] = 'running'): AgentRun => ({
  id: agentId, agentId, type: 't', description: agentId, model: 'm', status, startedAt, contextTokens: 0, contextMax: 1, steps: 0, round: 1,
})
const JETZT = 10_000_000

test('gleicheAb: nur ausdrückliches killed/failed/completed beendet einen Lauf', () => {
  const list = [lauf('a', 0), lauf('b', 0), lauf('c', 0), lauf('d', 0)]
  const echt = [{ id: 'a', status: 'running' }, { id: 'b', status: 'killed' }, { id: 'c', status: 'completed' }]
  const neu = gleicheAb(list, echt, JETZT)
  expect(neu.map(x => x.status)).toEqual(['running', 'failed', 'done', 'running'])
  expect(neu[1]!.endedAt).toBe(JETZT)
})

test('gleicheAb: fehlend, idle, waiting, fremde IDs und leere Liste ändern nichts; frischer Lauf hat Schonfrist', () => {
  const list = [lauf('a', 0), lauf('b', 0), lauf('neu', JETZT - 5000), lauf('fertig', 0, 'done')]
  expect(gleicheAb(list, [{ id: 'a', status: 'waiting' }, { id: 'b', status: 'idle' }, { id: 'neu', status: 'killed' }], JETZT)).toBe(list)
  expect(gleicheAb(list, [], JETZT)).toBe(list)
  expect(gleicheAb(list, [{ id: 'x', status: 'killed' }], JETZT)).toBe(list)
})
