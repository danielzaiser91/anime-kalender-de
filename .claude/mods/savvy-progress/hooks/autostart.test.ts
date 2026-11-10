import { test, expect, mock } from 'claude-code/testing'

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

test('Auto-Start: ein Agent beliebigen Typs zeigt die Leiste und öffnet das Panel, ohne dass `progress` gerufen wird', async ($, on) => {
  mock.clock(on)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('agent.spawn', () => ({ agentId: 'A1', model: 'claude-sonnet-5-5' }) as never)
  on('fs.read', () => ({ deny: 'fehlt' }) as never)
  // Boden unter dem Plugin: ohne bekannten Lauf zieht sich die Leiste zurück und reicht an die Engine durch.
  on('ui.render', () => ({ type: 'Text', props: {}, children: [] }) as never)
  const geoeffnet: string[] = []
  on('ui.open', (_$, e) => {
    geoeffnet.push(e.id)
    return { value: { isPlaced: true } } as never
  })
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })

  const leiste = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(text(await leiste.drawn()).join('')).not.toContain('▣')
  expect(geoeffnet).toEqual([])

  await $.agent.spawn({ prompt: 'x', description: 'Bauer PR 1', subagentType: 'general-purpose' })
  expect(text(await leiste.drawn()).join('')).toContain('▣ Agents')
  expect(geoeffnet).toEqual(['savvy-agents'])
  await leiste.unmount()
})

test('Auto-Start: der Agent-Tool-Aufruf eines beliebigen Typs zeigt die Leiste schon vor dem Start', async ($, on) => {
  mock.clock(on)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('fs.read', () => ({ deny: 'fehlt' }) as never)
  on('ui.render', () => ({ type: 'Text', props: {}, children: [] }) as never)
  on('tool.call', () => ({ result: 'ok' }) as never)
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const leiste = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await $.tool.call({ tool: 'Agent', subagent_type: 'general-purpose', description: 'x', prompt: 'x' } as never)
  expect(text(await leiste.drawn()).join('')).toContain('▣ Agents')
  await leiste.unmount()
})
