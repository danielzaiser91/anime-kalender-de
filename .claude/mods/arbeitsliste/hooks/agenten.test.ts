import { test, expect } from 'claude-code/testing'

import { lieseLaufende, laufzeitText, projektName } from './agenten'
import type { AgentenCache } from './agenten'
import { PANE, zeilen, starte } from './testhilfe'
import { agentenWelt } from './agenten-welt'

const JETZT = Date.parse('2026-11-15T12:00:00Z')
const MIN = 60_000
const GROSS = 4 * 1024 * 1024

// Eine Welt aus Dateien (Name der jsonl → Inhalt); Größe und mtime setzt der Test, nie der Text.
type Datei = { mtimeMs: number; size?: number; text: string; meta?: object | string; lesefehler?: string }
type Welt = Record<string, Datei>
function dateien(w: Welt, listFehler = '') {
  const stat = { gelesen: 0 }
  return {
    stat,
    list: async (_p: string) => {
      if (listFehler) throw new Error(listFehler)
      return Object.entries(w).map(([name, d]) => ({ name, mtimeMs: d.mtimeMs, size: d.size ?? 100 }))
    },
    read: async (p: string) => {
      const name = p.split('/').pop() as string
      const meta = name.endsWith('.meta.json')
      const d = w[meta ? name.replace('.meta.json', '.jsonl') : name]
      if (!d) throw new Error('ENOENT: no such file')
      if (meta) {
        if (d.meta === undefined) throw new Error('ENOENT: keine Meta')
        return typeof d.meta === 'string' ? d.meta : JSON.stringify(d.meta)
      }
      stat.gelesen++
      if (d.lesefehler) throw new Error(d.lesefehler)
      return d.text
    },
  }
}
const erste = (t: string) => JSON.stringify({ type: 'user', timestamp: t, message: { content: 'Auftrag' } })
const arbeit = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'x' }] } })
const bericht = JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', content: 'Report delivered to your caller' }] } })
const abbruch = JSON.stringify({ type: 'user', message: { content: [{ type: 'text', text: '[Request interrupted by user]' }] } })
const text = (t: string, letzte: string) => `${erste(t)}\n${letzte}\n`
const bauer = (beschreibung: string) => ({ agentType: 'bauer', description: beschreibung })
const START = '2026-11-15T11:00:00Z'
const laeuft = (mtimeMs = JETZT, size = 100): Datei => ({ mtimeMs, size, text: text(START, arbeit), meta: bauer('A') })

test('lieseLaufende: laufend, Bericht, Abbruch, finished, uralt, leer, ohne Meta; sortiert nach Start, nicht nach Dateiname', async () => {
  const w: Welt = {
    'agent-spaet.jsonl': { mtimeMs: JETZT, text: text('2026-11-15T11:50:00Z', arbeit) },
    'agent-lauf.jsonl': { mtimeMs: JETZT, text: text('2026-11-15T11:30:00Z', arbeit), meta: bauer('Bau X') },
    'agent-fertig.jsonl': { mtimeMs: JETZT, text: text(START, bericht), meta: bauer('fertig') },
    'agent-abbruch.jsonl': { mtimeMs: JETZT, text: text(START, abbruch), meta: bauer('abgebrochen') },
    'agent-meta.jsonl': { mtimeMs: JETZT, text: text(START, arbeit), meta: { ...bauer('Meta fertig'), finished: true } },
    'agent-alt.jsonl': { mtimeMs: JETZT - 61 * MIN, text: text('2026-11-15T09:00:00Z', arbeit), meta: bauer('hängt') },
    'agent-pruefer.jsonl': { mtimeMs: JETZT, text: text('2026-11-15T11:45:00Z', arbeit), meta: { agentType: 'pruefer', description: 'Prüfer PR 1' } },
    'agent-leer.jsonl': { mtimeMs: JETZT, text: '', meta: bauer('leer') },
    'notiz.txt': { mtimeMs: JETZT, text: 'x' },
  }
  const z = await lieseLaufende(dateien(w), 'o', JETZT, new Map())
  expect(z.fehler).toEqual([])
  expect(z.agenten).toEqual([
    { id: 'lauf', type: 'bauer', description: 'Bau X', start: Date.parse('2026-11-15T11:30:00Z') },
    { id: 'pruefer', type: 'pruefer', description: 'Prüfer PR 1', start: Date.parse('2026-11-15T11:45:00Z') },
    { id: 'spaet', type: '?', description: '', start: Date.parse('2026-11-15T11:50:00Z') },
  ])
})

test('lieseLaufende: finished nach der letzten Schreibung (jsonl unverändert) zählt sofort nicht mehr', async () => {
  const cache: AgentenCache = new Map()
  const w: Welt = { 'agent-a.jsonl': laeuft() }
  const d = dateien(w)
  expect((await lieseLaufende(d, 'o', JETZT, cache)).agenten).toHaveLength(1)
  w['agent-a.jsonl'] = { ...laeuft(), meta: { ...bauer('A'), finished: true } }
  expect((await lieseLaufende(d, 'o', JETZT + 1000, cache)).agenten).toEqual([])
  w['agent-a.jsonl'] = laeuft()
  expect((await lieseLaufende(d, 'o', JETZT + 2000, cache)).agenten).toHaveLength(1)
})

// Der Inhalt kippt auf „Bericht“; nur der Schlüssel (mtime, Größe) kann das der Mod verraten.
test('lieseLaufende: Schlüssel ist mtime und Größe — jede Änderung allein löst eine neue Lesung aus', async () => {
  for (const [mtime, size] of [[JETZT, 101], [JETZT + 1, 100]] as const) {
    const cache: AgentenCache = new Map()
    const w: Welt = { 'agent-a.jsonl': laeuft() }
    const d = dateien(w)
    expect((await lieseLaufende(d, 'o', JETZT, cache)).agenten).toHaveLength(1)
    w['agent-a.jsonl'] = { ...laeuft(mtime, size), text: text(START, bericht) }
    expect((await lieseLaufende(d, 'o', JETZT + 20_000, cache)).agenten).toEqual([])
  }
})

test('lieseLaufende: unveränderte Datei wird nicht erneut gelesen; eine geänderte höchstens alle 15 s', async () => {
  const cache: AgentenCache = new Map()
  const w: Welt = { 'agent-a.jsonl': laeuft() }
  const d = dateien(w)
  await lieseLaufende(d, 'o', JETZT, cache)
  await lieseLaufende(d, 'o', JETZT + 10_000, cache)
  expect(d.stat.gelesen).toBe(1)
  w['agent-a.jsonl'] = { ...laeuft(JETZT + 1, 200), text: text(START, bericht) }
  expect((await lieseLaufende(d, 'o', JETZT + 14_999, cache)).agenten).toHaveLength(1)
  expect(d.stat.gelesen).toBe(1)
  expect((await lieseLaufende(d, 'o', JETZT + 15_000, cache)).agenten).toEqual([])
  expect(d.stat.gelesen).toBe(2)
})

test('lieseLaufende: verschwindet die Datei und kommt mit gleichem Schlüssel zurück, wird sie neu gelesen', async () => {
  const cache: AgentenCache = new Map()
  const w: Welt = { 'agent-a.jsonl': laeuft() }
  const d = dateien(w)
  expect((await lieseLaufende(d, 'o', JETZT, cache)).agenten).toHaveLength(1)
  delete w['agent-a.jsonl']
  expect((await lieseLaufende(d, 'o', JETZT, cache)).agenten).toEqual([])
  w['agent-a.jsonl'] = { ...laeuft(), text: text(START, bericht) }
  expect((await lieseLaufende(d, 'o', JETZT, cache)).agenten).toEqual([])
})

test('lieseLaufende: Transkript über 4 MiB zählt nach mtime (2 min), der Start bleibt der erste gesehene; genau 4 MiB wird gelesen', async () => {
  const cache: AgentenCache = new Map()
  const meta = bauer('Riese')
  const frisch = dateien({ 'agent-r.jsonl': { mtimeMs: JETZT - MIN, size: GROSS + 1, text: 'nie gelesen', meta } })
  expect((await lieseLaufende(frisch, 'o', JETZT, cache)).agenten).toEqual([{ id: 'r', type: 'bauer', description: 'Riese', start: JETZT }])
  expect(frisch.stat.gelesen).toBe(0)
  const spaeter = dateien({ 'agent-r.jsonl': { mtimeMs: JETZT + 30 * MIN, size: GROSS + 2, text: 'nie gelesen', meta } })
  expect((await lieseLaufende(spaeter, 'o', JETZT + 30 * MIN, cache)).agenten[0]?.start).toBe(JETZT)
  const still = dateien({ 'agent-r.jsonl': { mtimeMs: JETZT - 3 * MIN, size: GROSS + 1, text: 'x', meta } })
  expect((await lieseLaufende(still, 'o', JETZT, new Map())).agenten).toEqual([])
  const genau = dateien({ 'agent-g.jsonl': { mtimeMs: JETZT, size: GROSS, text: text(START, bericht), meta } })
  expect((await lieseLaufende(genau, 'o', JETZT, new Map())).agenten).toEqual([])
  expect(genau.stat.gelesen).toBe(1)
})

test('lieseLaufende: Fehler sind sichtbar und werden nicht gemerkt; fehlender Ordner und fehlende Meta sind keine', async () => {
  const cache: AgentenCache = new Map()
  const d = dateien({ 'agent-e.jsonl': { mtimeMs: JETZT, text: `{kaputt\n${arbeit}\n`, meta: bauer('E') } })
  const z1 = await lieseLaufende(d, 'o', JETZT, cache)
  expect(z1.agenten.map(a => a.id)).toEqual(['e'])
  expect(z1.fehler).toHaveLength(1)
  expect(z1.fehler[0]).toContain('Erste Zeile')
  expect((await lieseLaufende(d, 'o', JETZT, cache)).fehler).toHaveLength(1)
  expect(d.stat.gelesen).toBe(2)

  const kaputtLetzte = dateien({ 'agent-l.jsonl': { mtimeMs: JETZT, text: `${erste(START)}\n{kaputt\n`, meta: bauer('L') } })
  const z3 = await lieseLaufende(kaputtLetzte, 'o', JETZT, new Map())
  expect(z3.agenten).toEqual([])
  expect(z3.fehler[0]).toContain('Letzte Zeile')

  const lesen = dateien({ 'agent-r.jsonl': { mtimeMs: JETZT, text: '', lesefehler: 'EACCES: gesperrt', meta: bauer('R') } })
  const z4 = await lieseLaufende(lesen, 'o', JETZT, new Map())
  expect(z4.agenten).toEqual([])
  expect(z4.fehler[0]).toContain('EACCES')

  const metaKaputt = dateien({ 'agent-m.jsonl': { mtimeMs: JETZT, text: text(START, arbeit), meta: '{kaputt' } })
  const z5 = await lieseLaufende(metaKaputt, 'o', JETZT, new Map())
  expect(z5.agenten).toHaveLength(1)
  expect(z5.fehler[0]).toContain('Meta')

  const listeKaputt = await lieseLaufende(dateien({}, 'EACCES: Ordner gesperrt'), 'o', JETZT, new Map())
  expect(listeKaputt.agenten).toEqual([])
  expect(listeKaputt.fehler[0]).toContain('EACCES')
  expect(await lieseLaufende(dateien({}, 'ENOENT: no such file'), 'o', JETZT, new Map())).toEqual({ agenten: [], fehler: [] })
  const ohneMeta = await lieseLaufende(dateien({ 'agent-o.jsonl': { mtimeMs: JETZT, text: text(START, arbeit) } }), 'o', JETZT, new Map())
  expect(ohneMeta.fehler).toEqual([])
})

test('lieseLaufende: ein behobener Fehler zählt beim nächsten Takt ohne neue Dateiänderung', async () => {
  const cache: AgentenCache = new Map()
  const w: Welt = { 'agent-e.jsonl': { ...laeuft(), text: `${erste(START)}\n{kaputt\n` } }
  const d = dateien(w)
  expect((await lieseLaufende(d, 'o', JETZT, cache)).agenten).toEqual([])
  w['agent-e.jsonl'] = laeuft()
  expect((await lieseLaufende(d, 'o', JETZT, cache)).agenten).toHaveLength(1)
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
