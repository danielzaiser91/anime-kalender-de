import { test, expect, mock } from 'claude-code/testing'

const STEP = 'mcp__savvy-progress__step'
const PANE = {
  plugin: 'savvy-progress',
  component: 'Pane',
  requestId: 'savvy-agents',
  props: { title: 'Agents', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

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

test('step: Schätzung des Agenten selbst, vorher „schätzt …“; nur die erste zählt', async ($, on) => {
  const uhr = mock.clock(on)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('agent.spawn', () => ({ agentId: 'A1', model: 'claude-sonnet-5-5' }) as never)
  on('fs.read', () => ({ deny: 'fehlt' }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  await $.agent.spawn({ prompt: 'x', description: 'Bauer PR 1', subagentType: 'general-purpose' })
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const gezeichnet = async () => text(await pane.drawn()).join('')

  expect(await gezeichnet()).toContain('schätzt …')
  expect(await gezeichnet()).not.toContain('/ ~')

  await $.tool.call({ tool: STEP, done: 0, total: 3, estimateMin: 15, agentId: 'A1' } as never)
  await uhr.advance(8 * 60_000 + 11_000)
  expect(await gezeichnet()).toContain('/ ~15 min')
  expect(await gezeichnet()).not.toContain('schätzt …')

  // ein zweiter Wert ändert die Anzeige nicht, ein Aufruf ohne Wert auch nicht
  await $.tool.call({ tool: STEP, done: 1, estimateMin: 25, agentId: 'A1' } as never)
  await $.tool.call({ tool: STEP, done: 2, agentId: 'A1' } as never)
  const z = await gezeichnet()
  expect(z).toContain('/ ~15 min')
  expect(z).not.toContain('~25')
  await pane.unmount()
})

test('Prüfer-Agenten: keine Schätzung, kein „schätzt …“ (auch nicht mit estimateMin); Bauer schon', async ($, on) => {
  mock.clock(on)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  let n = 0
  on('agent.spawn', () => ({ agentId: 'P' + ++n, model: 'claude-sonnet-5-5' }) as never)
  on('fs.read', () => ({ deny: 'fehlt' }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  await $.agent.spawn({ prompt: 'x', description: 'Prüfer PR 1', subagentType: 'general-purpose' })
  await $.agent.spawn({ prompt: 'x', description: 'Prüfer PR 2', subagentType: 'general-purpose' })
  await $.tool.call({ tool: STEP, done: 0, total: 3, estimateMin: 15, agentId: 'P2' } as never)
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  let z = text(await pane.drawn()).join('')
  expect(z).not.toContain('schätzt …')
  expect(z).not.toContain('/ ~')
  await $.agent.spawn({ prompt: 'x', description: 'Bauer Redesign', subagentType: 'general-purpose' })
  z = text(await pane.drawn()).join('')
  expect(z).toContain('schätzt …')
  await pane.unmount()
})
