import { test, expect } from 'claude-code/testing'

import { PANE, STAND, zeilen, hat, starte } from './testhilfe'

const MIT_TOP = `# Stand
Aktualisiert: 16.10.2026 13:25

## Top-Prios
- **D1** {arbeit-agent} Zuordner nachgebessert, Prüfung läuft [Plan](https://example.org/d1)
- **Speed** {live} Vorprüfung vor dem PR
  Eine Detailzeile
- **Lang** {pipeline} ${'Sehr langer Text mit vielen Wörtern. '.repeat(12)}[Bericht](file:///C:/x/b.md)

${STAND}`

async function pane($: any, on: any, stand = MIT_TOP) {
  starte(on, null, [], true, stand)
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  return $.ui.mount({ ...PANE, surface: 'terminal' })
}

test('Pane: Top-Prios als Kasten mit Rahmen ganz oben; Chip mit Status vor dem Titel', async ($, on) => {
  const p = await pane($, on)
  const z = zeilen(await p.drawn())
  expect(hat(await p.drawn(), 'borderStyle', 'round')).toBe(true)
  expect(z[0]).toBe('Top-Prios')
  expect(z).toContain('   AGENT  D1 Zuordner nachgebessert, Prüfung läuft')
  expect(z).toContain('▸  LIVE  Speed Vorprüfung vor dem PR')
  expect(hat(await p.drawn(), 'backgroundColor', 'suggestion')).toBe(true)
  expect(hat(await p.drawn(), 'backgroundColor', 'success')).toBe(true)
  expect(hat(await p.drawn(), 'backgroundColor', 'merged')).toBe(true)
  await p.unmount()
})

test('Pane: Links als Schaltflächen mit grauer Fläche und Pfeil in Link-Farbe', async ($, on) => {
  const p = await pane($, on)
  expect(hat(await p.drawn(), 'backgroundColor', 'subtle')).toBe(true)
  expect(hat(await p.drawn(), 'color', 'suggestion')).toBe(true)
  expect(zeilen(await p.drawn())).toContain('↗ Plan')
  await p.unmount()
})

test('Pane: Details und zu langer Text stehen nur hinter dem Knopf, Klick klappt auf und zu', async ($, on) => {
  const p = await pane($, on)
  let z = zeilen(await p.drawn()).join('\n')
  expect(z).not.toContain('Eine Detailzeile')
  expect(z).not.toContain('Sehr langer Text')
  expect(z).toContain('▸ ')
  await p.press({ key: 'klapp-Speed' })
  await p.press({ key: 'klapp-Lang' })
  z = zeilen(await p.drawn()).join('\n')
  expect(z).toContain('Eine Detailzeile')
  expect(z).toContain('Sehr langer Text')
  await p.press({ key: 'klapp-Speed' })
  expect(zeilen(await p.drawn()).join('\n')).not.toContain('Eine Detailzeile')
  await p.unmount()
})

test('Pane: unbekannter Status ist sichtbar (rot, mit Wort); Altzeile ohne Status ohne Chip und ohne Rot', async ($, on) => {
  const p = await pane($, on, '## Top-Prios\n- **A** {fertig} x\n- **B** y\n')
  const z = zeilen(await p.drawn())
  expect(z.some(s => s.includes('?fertig') && s.includes(' A '))).toBe(true)
  expect(z.some(s => s === '  B y')).toBe(true)
  expect(z.filter(s => s.includes('?')).length).toBe(1)
  expect(hat(await p.drawn(), 'backgroundColor', 'error')).toBe(true)
  await p.unmount()
})

test('Pane: ohne „## Top-Prios“ kein Kasten und kein Fehler', async ($, on) => {
  const p = await pane($, on, STAND)
  expect(hat(await p.drawn(), 'borderStyle', 'round')).toBe(false)
  expect(zeilen(await p.drawn()).join('\n')).not.toContain('Top-Prios')
  await p.unmount()
})
