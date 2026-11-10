import { test, expect, mock } from 'claude-code/testing'

const PANE = {
  plugin: 'savvy-progress',
  component: 'Pane',
  requestId: 'savvy-agents',
  props: { title: 'Agents', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

// Alle `source`-Strings (SVG) eines Baums.
function quellen(k: unknown, aus: string[] = []): string[] {
  if (k && typeof k === 'object') {
    const n = k as { props?: { source?: unknown; children?: unknown }; children?: unknown[] }
    if (typeof n.props?.source === 'string') aus.push(n.props.source)
    const kinder = n.children ?? (Array.isArray(n.props?.children) ? n.props.children : [])
    for (const c of kinder as unknown[]) quellen(c, aus)
  }
  return aus
}

test('Panel (Desktop): Bauer, Analyst, Prüfer, Rechercheur tragen ihr Kostüm, andere Typen den bisherigen Avatar', async ($, on) => {
  mock.clock(on)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  let n = 0
  on('agent.spawn', () => ({ agentId: 'R' + ++n, model: 'claude-sonnet-5-5' }) as never)
  on('fs.read', () => ({ deny: 'fehlt' }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  await $.session.start({ cwd: 'C:/x', surface: 'desktop', isInteractive: true })
  await $.agent.spawn({ prompt: 'x', description: 'Bauer PR 1', subagentType: 'bauer' })
  await $.agent.spawn({ prompt: 'x', description: 'Lücken suchen', subagentType: 'analyst' })
  await $.agent.spawn({ prompt: 'x', description: 'Prüfer PR 1', subagentType: 'general-purpose' })
  await $.agent.spawn({ prompt: 'x', description: 'Rechercheur Quellen', subagentType: 'general-purpose' })
  await $.agent.spawn({ prompt: 'x', description: 'Entwurf', subagentType: 'savvy-fable' })
  await $.agent.spawn({ prompt: 'x', description: 'Sonstiges', subagentType: 'general-purpose' })

  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const svgs = quellen(await pane.drawn())
  const klasse = (s: string) => /class="c-([a-z]+)/.exec(s)?.[1]
  const je = (beschr: string) => klasse(svgs.find(s => s.includes(beschr)) ?? '')
  expect(je('Bauer PR 1')).toBe('bauer')
  expect(je('Lücken suchen')).toBe('heavy')
  expect(je('Prüfer PR 1')).toBe('pruefer')
  expect(je('Rechercheur Quellen')).toBe('entdecker')
  expect(je('Entwurf')).toBe('fable')
  expect(je('Sonstiges')).toBe('other')
  // Bewegungen stehen vor der Regel für reduzierte Bewegung, damit sie davon abgeschaltet werden
  const css = svgs[1] ?? ''
  expect(css.indexOf('.c-bauer.run .ha')).toBeGreaterThan(-1)
  expect(css.indexOf('.c-bauer.run .ha')).toBeLessThan(css.indexOf('prefers-reduced-motion: reduce){.run,.run g'))
  await pane.unmount()
})
