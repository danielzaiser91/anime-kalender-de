import { test, expect } from 'claude-code/testing'

import { lieseLaufende, laufzeitText, projektName } from './agenten'
import type { AgentenCache } from './agenten'
import { PANE, zeilen, starte } from './testhilfe'
import { agentenWelt } from './agenten-welt'

const JETZT = Date.parse('2026-11-15T12:00:00Z')
const MIN = 60_000

// Eine Welt aus Dateien: Name → { mtimeMs, Text, Meta }; Text null = nicht lesbar (über 4 MiB).
type Datei = { mtimeMs: number; text: string | null; meta?: object }
function dateien(w: Record<string, Datei>) {
  return {
    list: async (_p: string) => Object.entries(w).map(([name, d]) => ({ name, mtimeMs: d.mtimeMs, size: (d.text ?? 'x'.repeat(5)).length })),
    read: async (p: string) => {
      const name = p.split('/').pop() as string
      const meta = name.endsWith('.meta.json')
      const d = w[meta ? name.replace('.meta.json', '.jsonl') : name]
      if (!d) throw new Error('fehlt')
      if (meta) {
        if (!d.meta) throw new Error('keine Meta')
        return JSON.stringify(d.meta)
      }
      if (d.text === null) throw new Error('zu gross')
      return d.text
    },
  }
}
const erste = (t: string) => JSON.stringify({ type: 'user', timestamp: t, message: { content: 'Auftrag' } })
const arbeit = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'x' }] } })
const bericht = JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', content: 'Report delivered to your caller' }] } })
const abbruch = JSON.stringify({ type: 'user', message: { content: [{ type: 'text', text: '[Request interrupted by user]' }] } })
const text = (t: string, letzte: string) => `${erste(t)}\n${letzte}\n`

test('lieseLaufende: laufend, Bericht, Abbruch, finished, uralt, ohne Meta', async () => {
  const cache: AgentenCache = new Map()
  const w = dateien({
    'agent-lauf.jsonl': { mtimeMs: JETZT, text: text('2026-11-15T11:30:00Z', arbeit), meta: { agentType: 'bauer', description: 'Bau X' } },
    'agent-fertig.jsonl': { mtimeMs: JETZT, text: text('2026-11-15T11:00:00Z', bericht), meta: { agentType: 'bauer', description: 'fertig' } },
    'agent-abbruch.jsonl': { mtimeMs: JETZT, text: text('2026-11-15T11:00:00Z', abbruch), meta: { agentType: 'bauer', description: 'abgebrochen' } },
    'agent-meta.jsonl': { mtimeMs: JETZT, text: text('2026-11-15T11:00:00Z', arbeit), meta: { agentType: 'bauer', description: 'Meta fertig', finished: true } },
    'agent-alt.jsonl': { mtimeMs: JETZT - 61 * MIN, text: text('2026-11-15T09:00:00Z', arbeit), meta: { agentType: 'bauer', description: 'hängt' } },
    'agent-pruefer.jsonl': { mtimeMs: JETZT, text: text('2026-11-15T11:45:00Z', arbeit), meta: { agentType: 'pruefer', description: 'Prüfer PR 1' } },
    'agent-keinemeta.jsonl': { mtimeMs: JETZT, text: text('2026-11-15T11:50:00Z', arbeit) },
    'notiz.txt': { mtimeMs: JETZT, text: 'x' },
  })
  const liste = await lieseLaufende(w, 'o', JETZT, cache)
  expect(liste).toEqual([
    { id: 'lauf', type: 'bauer', description: 'Bau X', start: Date.parse('2026-11-15T11:30:00Z') },
    { id: 'pruefer', type: 'pruefer', description: 'Prüfer PR 1', start: Date.parse('2026-11-15T11:45:00Z') },
    { id: 'keinemeta', type: '?', description: '', start: Date.parse('2026-11-15T11:50:00Z') },
  ])
})

test('lieseLaufende: Transkript über 4 MiB läuft, solange es frisch ist; der Start bleibt der erste gesehene', async () => {
  const cache: AgentenCache = new Map()
  const meta = { agentType: 'bauer', description: 'Riese' }
  const frisch = dateien({ 'agent-r.jsonl': { mtimeMs: JETZT - MIN, text: null, meta } })
  expect(await lieseLaufende(frisch, 'o', JETZT, cache)).toEqual([{ id: 'r', type: 'bauer', description: 'Riese', start: JETZT }])
  const spaeter = dateien({ 'agent-r.jsonl': { mtimeMs: JETZT + 30 * MIN, text: null, meta } })
  expect((await lieseLaufende(spaeter, 'o', JETZT + 30 * MIN, cache))[0]?.start).toBe(JETZT)
  const still = dateien({ 'agent-r.jsonl': { mtimeMs: JETZT - 3 * MIN, text: null, meta } })
  expect(await lieseLaufende(still, 'o', JETZT, new Map())).toEqual([])
})

test('lieseLaufende: unveränderte Datei wird nicht erneut gelesen; Änderung zählt neu; Ordner fehlt ergibt leer', async () => {
  const cache: AgentenCache = new Map()
  const w: Record<string, Datei> = { 'agent-a.jsonl': { mtimeMs: JETZT, text: text('2026-11-15T11:00:00Z', arbeit), meta: { agentType: 'bauer', description: 'A' } } }
  let gelesen = 0
  const d = dateien(w)
  const zaehlend = { list: d.list, read: async (p: string) => { gelesen++; return d.read(p) } }
  expect(await lieseLaufende(zaehlend, 'o', JETZT, cache)).toHaveLength(1)
  const nachErstem = gelesen
  expect(await lieseLaufende(zaehlend, 'o', JETZT, cache)).toHaveLength(1)
  expect(gelesen).toBe(nachErstem)
  w['agent-a.jsonl'] = { mtimeMs: JETZT + 1, text: text('2026-11-15T11:00:00Z', bericht), meta: { agentType: 'bauer', description: 'A' } }
  expect(await lieseLaufende(zaehlend, 'o', JETZT + 1, cache)).toEqual([])
  const kaputt = { list: async () => { throw new Error('fehlt') }, read: async () => '' }
  expect(await lieseLaufende(kaputt, 'o', JETZT, cache)).toEqual([])
})

test('laufzeitText und projektName', () => {
  expect(laufzeitText(null, JETZT)).toBe('–')
  expect(laufzeitText(JETZT - 30_000, JETZT)).toBe('<1 min')
  expect(laufzeitText(JETZT - 12 * MIN, JETZT)).toBe('12 min')
  expect(laufzeitText(JETZT - 65 * MIN, JETZT)).toBe('1 h 05 min')
  expect(laufzeitText(JETZT + MIN, JETZT)).toBe('<1 min')
  expect(projektName('C:\\code\\ai\\anime-kalender-de')).toBe('C--code-ai-anime-kalender-de')
})

test('Pane: Abschnitt „Agenten“ mit Typ, Beschreibung und Laufzeit je laufendem Agenten', async ($, on) => {
  starte(on, null)
  agentenWelt.liste = [
    { id: 'b', type: 'bauer', description: 'Netflix Teil 2' },
    { id: 'p', type: 'pruefer', description: 'Prüfer PR 9' },
    { id: 'f', type: 'bauer', description: 'schon fertig', bericht: true },
  ]
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const z = zeilen(await pane.drawn())
  expect(z).toContain('Agenten 1+1')
  expect(z.some(s => /^ {2}● bauer · Netflix Teil 2 · \d+ h \d\d min$/.test(s))).toBe(true)
  expect(z.some(s => /^ {2}● pruefer · Prüfer PR 9 · /.test(s))).toBe(true)
  expect(z.some(s => s.includes('schon fertig'))).toBe(false)
  await pane.unmount()
})

test('Pane: ohne laufende Agenten kein Abschnitt', async ($, on) => {
  starte(on, null)
  await $.session.start({ cwd: 'C:/x', surface: 'terminal', isInteractive: true })
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(zeilen(await pane.drawn()).some(s => s.startsWith('Agenten'))).toBe(false)
  await pane.unmount()
})
