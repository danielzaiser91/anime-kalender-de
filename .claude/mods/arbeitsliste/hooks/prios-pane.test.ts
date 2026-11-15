import { test, expect } from 'claude-code/testing'

import { PANE, STAND, zeilen, hat, starte } from './testhilfe'
import { STAND_ALTFORMAT } from './stand-altformat'

const MIT_TOP = `# Stand
Aktualisiert: 16.10.2026 13:25

## Top-Prios
- **D1** {arbeit-agent} Zuordner nachgebessert, Prüfung läuft — [Plan](https://example.org/d1)
- **Speed** {live} Vorprüfung vor dem PR
  Eine Detailzeile
- **Lang** {pipeline} ${'Sehr langer Text mit vielen Wörtern. '.repeat(12)}— [Bericht](file:///C:/x/b.md)

${STAND}`

async function pane($: any, on: any, stand = MIT_TOP, gestartet: string[][] = [], surface = 'terminal') {
  on('process.run', (_$: any, e: any) => { gestartet.push([...e.argv]); return { value: { exitCode: 0, stdout: '', stderr: '' } } as never })
  starte(on, null, [], true, stand)
  await $.session.start({ cwd: 'C:/x', surface, isInteractive: true })
  return $.ui.mount({ ...PANE, surface })
}

test('Pane: Ziele als Kasten mit Rahmen ganz oben; zugeklappt je Ziel nur Chip und Name, Schalter darunter', async ($, on) => {
  const p = await pane($, on)
  const z = zeilen(await p.drawn())
  expect(hat(await p.drawn(), 'borderStyle', 'round')).toBe(true)
  expect(z.slice(0, 7)).toEqual(['Ziele', ' AGENT  D1', '▸', ' LIVE  Speed', '▸', ' PIPELINE  Lang', '▸'])
  expect(hat(await p.drawn(), 'backgroundColor', 'suggestion')).toBe(true)
  expect(hat(await p.drawn(), 'backgroundColor', 'success')).toBe(true)
  expect(hat(await p.drawn(), 'backgroundColor', 'merged')).toBe(true)
  expect(hat(await p.drawn(), 'backgroundColor', 'subtle')).toBe(false)
  await p.unmount()
})

test('Pane: aufgeklappt Text, Details und Links als Schaltflächen mit grauer Fläche; Klick klappt auf und zu', async ($, on) => {
  const p = await pane($, on)
  let z = zeilen(await p.drawn()).join('\n')
  expect(z).not.toContain('Eine Detailzeile')
  expect(z).not.toContain('Sehr langer Text')
  await p.press({ key: 'klapp-Speed' })
  await p.press({ key: 'klapp-D1' })
  z = zeilen(await p.drawn()).join('\n')
  expect(z).toContain('Vorprüfung vor dem PR')
  expect(z).toContain('Eine Detailzeile')
  expect(z).toContain('↗ Plan')
  expect(hat(await p.drawn(), 'backgroundColor', 'subtle')).toBe(true)
  expect(z).toContain('▾')
  await p.press({ key: 'klapp-Speed' })
  expect(zeilen(await p.drawn()).join('\n')).not.toContain('Eine Detailzeile')
  await p.unmount()
})

test('Pane: unbekannter Status ist sichtbar (rot, mit Wort); Altzeile ohne Status ohne Chip und ohne Rot', async ($, on) => {
  const p = await pane($, on, '## Top-Prios\n- **A** {fertig} x\n- **B** y\n')
  const z = zeilen(await p.drawn())
  expect(z.some(s => s.includes('?fertig') && s.includes(' A'))).toBe(true)
  expect(z).toContain('B')
  expect(z.filter(s => s.includes('?')).length).toBe(1)
  expect(hat(await p.drawn(), 'backgroundColor', 'error')).toBe(true)
  await p.unmount()
})

test('Pane: ohne „## Top-Prios“ kein Kasten und kein Fehler', async ($, on) => {
  const p = await pane($, on, STAND)
  expect(hat(await p.drawn(), 'borderStyle', 'round')).toBe(false)
  expect(zeilen(await p.drawn()).join('\n')).not.toContain('Ziele')
  await p.unmount()
})

test('Pane: Klick auf einen Link-Knopf öffnet das Ziel im Explorer', async ($, on) => {
  const gestartet: string[][] = []
  const p = await pane($, on, MIT_TOP, gestartet)
  await p.press({ key: 'klapp-D1' })
  await p.press({ key: 'link:D1:0' })
  await new Promise(r => setTimeout(r, 30))
  expect(gestartet).toEqual([['explorer.exe', 'https://example.org/d1']])
  await p.unmount()
})

test('Pane: Details sind eingerückt (marginLeft), nicht per Leerzeichen-Präfix', async ($, on) => {
  const p = await pane($, on)
  expect(hat(await p.drawn(), 'marginLeft', 2)).toBe(false)
  await p.press({ key: 'klapp-Speed' })
  expect(hat(await p.drawn(), 'marginLeft', 2)).toBe(true)
  expect(zeilen(await p.drawn())).toContain('Eine Detailzeile')
  await p.unmount()
})

test('Pane: echte stand.md im Altformat zeigt lesbare Sätze, Knöpfe, keinen Fehler-Chip', async ($, on) => {
  const p = await pane($, on, STAND_ALTFORMAT)
  await p.press({ key: 'klapp-Unzuordenbare Folgen' })
  await p.press({ key: 'klapp-Speed (Kleinigkeit in unter 5 min live)' })
  const z = zeilen(await p.drawn()).join(' ')
  expect(z).toContain('Speed (Kleinigkeit in unter 5 min live)')
  expect(z).toContain('geklärt (Bericht)')
  expect(z).toContain('Berichte: Engpass, Gegenentwurf')
  expect(hat(await p.drawn(), 'backgroundColor', 'error')).toBe(false)
  expect(z).not.toContain('?')
  expect(hat(await p.drawn(), 'backgroundColor', 'subtle')).toBe(true)
  await p.unmount()
})
