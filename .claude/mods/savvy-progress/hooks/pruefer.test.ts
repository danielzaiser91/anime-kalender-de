import { test, expect, mock } from 'claude-code/testing'

import { istPruefer } from './pruefer'

const PANE = {
  plugin: 'savvy-progress',
  component: 'Pane',
  requestId: 'savvy-agents',
  props: { title: 'Agents', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const
const BAND = { plugin: 'savvy-progress', component: 'AbovePrompt', props: { hasSurvey: false, bodyColumns: 100 } } as const

// Sichtbarer Text eines Baums (Strings und Button-Labels).
function text(k: unknown, aus: string[] = []): string[] {
  if (typeof k === 'string') aus.push(k)
  else if (k && typeof k === 'object') {
    const n = k as { props?: { label?: string; children?: unknown }; children?: unknown[] }
    if (typeof n.props?.label === 'string') aus.push(n.props.label)
    const kinder = n.children ?? (Array.isArray(n.props?.children) ? n.props.children : [])
    for (const c of kinder as unknown[]) text(c, aus)
  }
  return aus
}

test('istPruefer: Typ pruefer oder Beschreibung „Prüfer …“, sonst nicht', () => {
  expect(istPruefer({ type: 'pruefer', description: 'x' })).toBe(true)
  expect(istPruefer({ type: 'general-purpose', description: ' Prüfer PR 3' })).toBe(true)
  expect(istPruefer({ type: 'general-purpose', description: 'Bauer PR 3' })).toBe(false)
  expect(istPruefer({ type: 'general-purpose', description: 'Der Prüfer' })).toBe(false)
})

test('Prüfer: eigener Bereich „Prüfer · N“, zählen weder bei „Running“ noch am Agents-Knopf; einklappbar', async ($, on) => {
  mock.clock(on)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  let n = 0
  on('agent.spawn', () => ({ agentId: 'P' + ++n, model: 'claude-sonnet-5-5' }) as never)
  on('fs.read', () => ({ deny: 'fehlt' }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'Text', props: {}, children: [] }) as never)
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  await $.agent.spawn({ prompt: 'x', description: 'Bauer PR 1', subagentType: 'general-purpose' })
  await $.agent.spawn({ prompt: 'x', description: 'Prüfer PR 1', subagentType: 'general-purpose' })
  await $.agent.spawn({ prompt: 'x', description: 'Schlanke Prüfung', subagentType: 'pruefer' })

  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  let z = text(await pane.drawn()).join('')
  expect(z).toContain('Running · 1')
  expect(z).toContain('▾ Prüfer · 2')
  expect(z).toContain('Prüfer PR 1')
  expect(z.indexOf('Running · 1')).toBeLessThan(z.indexOf('Prüfer · 2'))
  // Knopf: nur der Bauer zählt
  const knopf = text(await band.drawn()).join('')
  expect(knopf).toContain('▣ Agents 1')
  expect(knopf).not.toContain('Agents 3')

  // einklappen: Überschrift bleibt, Zeilen weg
  await $.ui.press({ plugin: 'savvy-progress', key: 'reviewers', requestId: 'savvy-agents', surface: 'terminal' } as never)
  z = text(await pane.drawn()).join('')
  expect(z).toContain('▸ Prüfer · 2')
  expect(z).not.toContain('Prüfer PR 1')
  expect(z).toContain('Bauer PR 1')
  await pane.unmount()
  await band.unmount()
})
