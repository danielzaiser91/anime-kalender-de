import { test, expect } from 'claude-code/testing'

import { PANE, STAND, zeilen, starte } from './testhilfe'
import { balken, geradeInArbeit, zaehleZiele, zielZeile, zielZu } from './ziele'

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

const K = (art: string, titel: string, tag: string, extra = '') => `- 🔵 **${titel}** {${art} · normal · - · ${tag}${extra}} Text`
const STAND_K = ['## In Arbeit (Stand 08.11.2026 12:00)', K('auftrag', 'Eins', '01.11.'), K('kritisch', 'Zwei', '02.11.'), K('eigen', 'Drei', '03.11.', ' · wartet: Lauf'), K('eigen', 'Vier', '04.11.'), K('eigen', 'Fünf', '05.11.'), K('eigen', 'Sechs', '06.11.'), K('eigen', 'Sieben', '07.11.'), K('eigen', 'Acht', '08.11.'), '## Als Nächstes', K('kritisch', 'Nicht laufend', '01.11.')].join('\n')

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

test('geradeInArbeit: Rangfolge, wartet und „Als Nächstes“ zählen nicht, höchstens fünf', () => {
  const g = geradeInArbeit(STAND_K, Date.parse('2026-11-08T12:00:00Z'))
  expect(g.titel).toEqual(['Zwei', 'Eins', 'Vier', 'Fünf', 'Sechs'])
  expect(g.mehr).toBe(2)
  expect(geradeInArbeit('', 0)).toEqual({ titel: [], mehr: 0 })
})

async function pane($: any, on: any, stand: string, ziele: string) {
  starte(on, null, [], true, stand, false, 0, 0, false, ziele)
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  return $.ui.mount({ ...PANE, surface: 'terminal' })
}

test('Pane: Ziele-Kasten mit Balken unter dem Ziel; „Gerade in Arbeit“ mit fünf Zeilen und Rest', async ($, on) => {
  const stand = `# Stand\n\n## Top-Prios\n- **Ziel 1 · Autonomie** {arbeit-ich} läuft\n- **Ziel 2 · Live in 5 min** {queue} x\n- **Ziel 3 · Vollständige Daten** {queue} y\n\n${STAND_K}\n`
  const p = await pane($, on, stand, ZIELE)
  const z = zeilen(await p.drawn())
  expect(z[0]).toBe('Ziele')
  expect(z).toContain('    █████░░░░░ 2 von 4 · Prüfer in der Cloud')
  expect(z).toContain('    ░░░░░░░░░░ 0 von 1 · Deploy unter 5 min')
  expect(z.join('\n')).not.toContain('0 von 0')
  expect(z).toContain('▾ Gerade in Arbeit')
  expect(z).toContain('  ● Zwei')
  expect(z).toContain('  + 2 weitere')
  expect(z.join('\n')).not.toContain('Nicht laufend')
  // Einklapp-Schalter wie bei den anderen Bereichen
  await p.press({ key: 'bereich:gerade' })
  const zu = zeilen(await p.drawn())
  expect(zu).toContain('▸ Gerade in Arbeit')
  expect(zu).not.toContain('  ● Zwei')
  expect(zu).not.toContain('  + 2 weitere')
  await p.press({ key: 'bereich:gerade' })
  expect(zeilen(await p.drawn())).toContain('  ● Zwei')
  await p.unmount()
})

test('Pane: ohne ziele.md kein Balken und kein Fehler; ohne Kennzeichen kein „Gerade in Arbeit“', async ($, on) => {
  const p = await pane($, on, `# Stand\n\n## Top-Prios\n- **Ziel 1 · Autonomie** {arbeit-ich} läuft\n\n${STAND}`, '')
  const z = zeilen(await p.drawn())
  expect(z.join('\n')).not.toContain('█')
  expect(z.join('\n')).not.toContain('░')
  expect(z).not.toContain('Gerade in Arbeit')
  await p.unmount()
})
