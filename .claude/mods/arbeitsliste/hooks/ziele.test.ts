import { test, expect } from 'claude-code/testing'

import { PANE, STAND, zeilen, starte } from './testhilfe'
import { balken, zaehleZiele, zielZeile, zielZu } from './ziele'

const ZIELE = `# Ziele

## Autonomie
Alles läuft ohne KI weiter.
- [erreicht] Sammler per Wecker — [Beleg](https://x.org/a)
- [erreicht] Nacht-Merger
- [in Arbeit] **Prüfer in der Cloud** — [PR](https://x.org/b)
- [offen] Lehren mechanisch

## Live in 5 min
- [offen] Deploy unter 5 min

## Vollständige Daten
Noch keine Meilensteine.
`

test('zaehleZiele: Zählung, nächster Meilenstein ohne Fettdruck und Beleg, Ziel ohne Meilensteine', () => {
  const z = zaehleZiele(ZIELE)
  expect(z.map(x => [x.name, x.erreicht, x.gesamt, x.naechster])).toEqual([
    ['Autonomie', 2, 4, 'Prüfer in der Cloud'],
    ['Live in 5 min', 0, 1, 'Deploy unter 5 min'],
    ['Vollständige Daten', 0, 0, null],
  ])
  expect(zaehleZiele('')).toEqual([])
})

test('balken und zielZeile: gerundet auf zehn Stellen; alles erreicht ohne „nächster“', () => {
  expect(balken({ name: 'x', erreicht: 2, gesamt: 4, naechster: null })).toBe('█████░░░░░')
  expect(balken({ name: 'x', erreicht: 0, gesamt: 0, naechster: null })).toBe('░░░░░░░░░░')
  expect(balken({ name: 'x', erreicht: 2, gesamt: 3, naechster: null })).toBe('███████░░░')
  expect(zielZeile({ name: 'x', erreicht: 3, gesamt: 3, naechster: null })).toBe('██████████ 3 von 3')
  expect(zielZeile(zaehleZiele(ZIELE)[0]!)).toBe('█████░░░░░ 2 von 4 · Prüfer in der Cloud')
})

test('zielZu: Name im Kastentitel; kein Treffer ohne Namen', () => {
  const z = zaehleZiele(ZIELE)
  expect(zielZu('Ziel 2 · Live in 5 min', z)?.name).toBe('Live in 5 min')
  expect(zielZu('Ziel 9 · Unbekannt', z)).toBeUndefined()
})

async function pane($: any, on: any, stand: string, ziele: string) {
  starte(on, null, [], true, stand, false, 0, 0, false, ziele)
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  return $.ui.mount({ ...PANE, surface: 'terminal' })
}

test('Pane: Ziele-Kasten mit % in der Zeile, Balken im Ausklapp-Teil; „Gerade in Arbeit“ gibt es nicht mehr', async ($, on) => {
  const stand = `# Stand\n\n## Top-Prios\n- **Autonomie** {arbeit-ich} läuft\n- **Live in 5 min** {queue} x\n- **Vollständige Daten** {queue} y\n\n## In Arbeit (Stand 08.11.2026 12:00)\n- 🔵 **Eins** {auftrag · normal · - · 01.11.} Text\n`
  const p = await pane($, on, stand, ZIELE)
  let z = zeilen(await p.drawn())
  expect(z.slice(0, 4)).toEqual(['Ziele', ' CLAUDE  Autonomie 50 %', '▸', ' QUEUE  Live in 5 min 0 %'])
  expect(z).toContain(' QUEUE  Vollständige Daten')
  expect(z.join('\n')).not.toContain('█')
  await p.press({ key: 'klapp-Autonomie' })
  await p.press({ key: 'klapp-Live in 5 min' })
  z = zeilen(await p.drawn())
  expect(z).toContain('█████░░░░░ 2 von 4 · Prüfer in der Cloud')
  expect(z).toContain('░░░░░░░░░░ 0 von 1 · Deploy unter 5 min')
  expect(z.join('\n')).not.toContain('0 von 0')
  expect(z.join('\n')).not.toContain('Gerade in Arbeit')
  await p.unmount()
})

test('Pane: ohne ziele.md kein Balken und kein Fehler', async ($, on) => {
  const p = await pane($, on, `# Stand\n\n## Top-Prios\n- **Ziel 1 · Autonomie** {arbeit-ich} läuft\n\n${STAND}`, '')
  const z = zeilen(await p.drawn())
  expect(z.join('\n')).not.toContain('█')
  expect(z.join('\n')).not.toContain('░')
  await p.unmount()
})
