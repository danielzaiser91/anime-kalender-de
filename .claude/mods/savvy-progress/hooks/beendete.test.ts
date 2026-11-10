import { test, expect, mock } from 'claude-code/testing'

import { BEHALTE_BEENDETE, kappeBeendete } from './beendete'
import type { AgentRun } from '../types'

const PANE = {
  plugin: 'savvy-progress',
  component: 'Pane',
  requestId: 'savvy-agents',
  props: { title: 'Agents', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

const lauf = (id: string, status: AgentRun['status']): AgentRun => ({
  id,
  type: 'general-purpose',
  description: id,
  model: 'm',
  status,
  startedAt: 0,
  contextTokens: 0,
  contextMax: 1,
  steps: 0,
  round: 1,
})

test('kappeBeendete: Laufende bleiben alle, von den Beendeten nur die neuesten', () => {
  const liste = [lauf('r0', 'running'), ...Array.from({ length: 30 }, (_, i) => lauf('b' + i, i % 2 ? 'failed' : 'done')), lauf('r1', 'running')]
  const kurz = kappeBeendete(liste)
  const beendet = kurz.filter(a => a.status !== 'running')
  expect(kurz.filter(a => a.status === 'running').map(a => a.id)).toEqual(['r0', 'r1'])
  expect(beendet.length).toBe(BEHALTE_BEENDETE)
  expect(beendet[beendet.length - 1]?.id).toBe('b29')
  expect(beendet[0]?.id).toBe('b' + (30 - BEHALTE_BEENDETE))
})

test('kappeBeendete: nichts zu kappen gibt dieselbe Liste zurück (kein Schreiben)', () => {
  const liste = [lauf('a', 'done'), lauf('b', 'running')]
  expect(kappeBeendete(liste)).toBe(liste)
})

test('Panel: Fertige und Fehlgeschlagene erscheinen nicht, Laufende schon', async ($, on) => {
  mock.clock(on)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  let n = 0
  on('agent.spawn', () => ({ agentId: 'A' + ++n, model: 'claude-sonnet-5-5' }) as never)
  on('turn.complete', () => ({ text: 'ok' }) as never)
  on('fs.read', () => ({ deny: 'fehlt' }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  await $.session.start({ cwd: 'C:/x', surface: 'desktop', isInteractive: true })
  for (let i = 0; i < 40; i++) {
    await $.agent.spawn({ prompt: 'x', description: 'Fertig ' + i, subagentType: 'general-purpose' })
    await $.turn.complete({ agentId: 'A' + (i + 1), reason: i % 3 ? 'answer' : 'error', answer: 'ok' } as never)
  }
  await $.agent.spawn({ prompt: 'x', description: 'Läuft noch', subagentType: 'general-purpose' })

  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const quelle = JSON.stringify(await pane.drawn())
  expect(quelle).toContain('Läuft noch')
  expect(quelle).not.toContain('Fertig 39')
  expect(quelle).not.toContain('Fertig 0<')
  expect(quelle).not.toContain('Finished')
  await pane.unmount()
})
