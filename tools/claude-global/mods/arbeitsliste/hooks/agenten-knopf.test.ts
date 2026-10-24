import { test, expect } from 'claude-code/testing'
import type { On } from 'claude-code'

import { BAND, starte } from './testhilfe'
import { haengeAgentenKnopfHaken } from './savvy-haken-kopie'

// Gemeinsame Welt: das Pane „savvy-agents“ ist offen oder zu; Hinweise und Befehle landen im Protokoll.
function welt(on: On, log: string[]) {
  const zustand = { offen: false }
  on('ui.panes', () => ({ value: [{ id: 'savvy-agents', isShown: zustand.offen }] }) as never)
  on('ui.toast', (_$, e) => { log.push(`toast:${(e as { text?: string }).text}`); return { value: undefined } as never })
  on('command.run', () => { log.push('befehl'); return { text: 'ok' } as never })
  return () => { zustand.offen = !zustand.offen; log.push(zustand.offen ? 'savvy:auf' : 'savvy:zu') }
}

async function klicke(band: { press: (e: { key: string }) => Promise<unknown> }) {
  await band.press({ key: 'agents-oeffnen' })
  await new Promise(r => setTimeout(r, 30))
}

test('Knopf + savvy-Haken zusammen: Klick öffnet, zweiter Klick schließt, kein Befehl im Chat, kein Hinweis', async ($, on) => {
  starte(on, null)
  const log: string[] = []
  haengeAgentenKnopfHaken(on, welt(on, log))
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await klicke(band)
  await klicke(band)
  expect(log).toEqual(['savvy:auf', 'savvy:zu'])
  await band.unmount()
})

test('Knopf ohne savvy-Haken: kurzer Hinweis je Klick, nichts öffnet sich', async ($, on) => {
  starte(on, null)
  const log: string[] = []
  welt(on, log)
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await klicke(band)
  await klicke(band)
  expect(log).toHaveLength(2)
  expect(log[0]).toMatch(/^toast:Agents-Pane: savvy-progress reagiert nicht/)
  expect(log[1]).toBe(log[0])
  await band.unmount()
})

test('Neustart ohne Klick: kein Phantom-Schalten, der Zähler wird beim Start nicht geschrieben', async ($, on) => {
  starte(on, null)
  const log: string[] = []
  haengeAgentenKnopfHaken(on, welt(on, log))
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await new Promise(r => setTimeout(r, 30))
  expect(log).toEqual([])
  await band.unmount()
})
