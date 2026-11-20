import type { On } from 'claude-code'

// Attrappe des Subagenten-Ordners der Testsitzung (Sitzung eigene-sitzung). Jede Datei wie im Betrieb:
// agent-<id>.jsonl (erste Zeile mit Zeitstempel, letzte Zeile Arbeit oder abgegebener Bericht) und agent-<id>.meta.json.
// Schlüssel (mtime, Größe) setzt allein der Test: die Attrappe leitet sie nie aus dem Inhalt ab, sonst verdeckt sie, dass
// ein Urteil ohne Änderung des Schlüssels kippen kann.
// mtimeMs: sehr groß = „gerade geschrieben“ (die Mod liest die Uhr, der Test nicht), 0 = uralt.
export const FRISCH = 9e15

export type FakeAgent = {
  id: string
  type?: string
  description: string
  finished?: boolean
  // Letzte Zeile ist der abgegebene Bericht.
  bericht?: boolean
  mtimeMs?: number
  size?: number
  start?: string
  // Rohtext statt der erzeugten ersten/letzten Zeile (kaputte Zeilen).
  erste?: string
  letzte?: string
}

export const agentenWelt = {
  liste: [] as FakeAgent[],
  listAufrufe: 0,
  // Projektordner, unter dem die Agenten liegen; root und cwd der Sitzung.
  projekt: 'C--x',
  root: 'C:/x',
  cwd: 'C:/x',
  // Fehlertext, mit dem `$.fs.list` abgelehnt wird.
  listFehler: '' as string,
}

// n Agenten, die ersten `pruefer` davon Prüfer.
export function fakeAgenten(n: number, pruefer = 0): FakeAgent[] {
  return Array.from({ length: n }, (_, i) => ({ id: `a${i}`, type: i < pruefer ? 'pruefer' : 'bauer', description: i < pruefer ? `Prüfer ${i}` : `Bauer ${i}` }))
}

function jsonl(a: FakeAgent): string {
  const erste = a.erste ?? JSON.stringify({ type: 'user', timestamp: a.start ?? '2020-01-01T00:00:00.000Z', message: { content: 'Auftrag' } })
  const bericht = { type: 'user', message: { content: [{ type: 'tool_result', content: 'Report delivered to your caller' }] } }
  const arbeit = { type: 'assistant', message: { content: [{ type: 'text', text: 'arbeite' }] } }
  return `${erste}\n${a.letzte ?? JSON.stringify(a.bericht ? bericht : arbeit)}\n`
}

// Antwort für einen Lesezugriff auf die Attrappe oder undefined, wenn der Pfad nicht dazugehört.
export function lieseAgentenDatei(pfad: string): { value: string } | { deny: string } | undefined {
  const m = pfad.replace(/\\/g, '/').match(/\/subagents\/agent-(.+)\.(jsonl|meta\.json)$/)
  if (!m) return undefined
  const a = agentenWelt.liste.find(x => x.id === m[1])
  if (!a) return { deny: 'fehlt' }
  if (m[2] === 'jsonl') return { value: jsonl(a) }
  return { value: JSON.stringify({ agentType: a.type, description: a.description, finished: a.finished }) }
}

// `weitere`: Verzeichnisse anderer Tests (z. B. Zielordner); null = nicht deren Pfad.
export function haengeAgentenListe(on: On, weitere: (pfad: string) => { name: string; kind: string }[] | null = () => null): void {
  on('session.cwd', () => ({ value: agentenWelt.cwd }) as never)
  on('session.root', () => ({ value: agentenWelt.root }) as never)
  on('fs.list', (_$, e) => {
    const pfad = (e as { path?: string }).path?.replace(/\\/g, '/') ?? ''
    const fremd = weitere(pfad)
    if (fremd) return { value: fremd.map(e => ({ ...e, size: 0, mtimeMs: 1, isLink: false })) } as never
    agentenWelt.listAufrufe++
    if (agentenWelt.listFehler) return { deny: agentenWelt.listFehler } as never
    if (!pfad.endsWith(`/${agentenWelt.projekt}/eigene-sitzung/subagents`)) return { deny: 'ENOENT: no such file' } as never
    const eintraege = agentenWelt.liste.map(a => ({ name: `agent-${a.id}.jsonl`, kind: 'file', size: a.size ?? 100, mtimeMs: a.mtimeMs ?? FRISCH, isLink: false }))
    return { value: eintraege } as never
  })
}
