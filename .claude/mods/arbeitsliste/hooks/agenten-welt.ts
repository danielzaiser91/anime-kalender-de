import type { On } from 'claude-code'

// Attrappe des Subagenten-Ordners der Testsitzung (cwd C:/x, Sitzung eigene-sitzung). Jede Datei wie im Betrieb:
// agent-<id>.jsonl (erste Zeile mit Zeitstempel, letzte Zeile Arbeit oder abgegebener Bericht) und agent-<id>.meta.json.
export const AGENTEN_ORDNER = 'C:/Users/ih/.claude/projects/C--x/eigene-sitzung/subagents'
// mtimeMs: sehr groß = „gerade geschrieben“ (die Mod liest die Uhr, der Test nicht), 0 = uralt.
export const FRISCH = 9e15

export type FakeAgent = {
  id: string
  type?: string
  description: string
  finished?: boolean
  // Letzte Zeile ist der abgegebene Bericht.
  bericht?: boolean
  // Transkript über 4 MiB: $.fs.read lehnt ab.
  gross?: boolean
  mtimeMs?: number
  start?: string
}

export const agentenWelt = { liste: [] as FakeAgent[], listAufrufe: 0 }

// n Agenten, die ersten `pruefer` davon Prüfer.
export function fakeAgenten(n: number, pruefer = 0): FakeAgent[] {
  return Array.from({ length: n }, (_, i) => ({ id: `a${i}`, type: i < pruefer ? 'pruefer' : 'bauer', description: i < pruefer ? `Prüfer ${i}` : `Bauer ${i}` }))
}

function jsonl(a: FakeAgent): string {
  const erste = { type: 'user', timestamp: a.start ?? '2020-01-01T00:00:00.000Z', message: { content: 'Auftrag' } }
  const letzte = a.bericht
    ? { type: 'user', message: { content: [{ type: 'tool_result', content: 'Report delivered to your caller' }] } }
    : { type: 'assistant', message: { content: [{ type: 'text', text: 'arbeite' }] } }
  return `${JSON.stringify(erste)}\n${JSON.stringify(letzte)}\n`
}

// Antwort für einen Lesezugriff auf die Attrappe oder undefined, wenn der Pfad nicht dazugehört.
export function lieseAgentenDatei(pfad: string): { value: string } | { deny: string } | undefined {
  const m = pfad.replace(/\\/g, '/').match(/\/subagents\/agent-(.+)\.(jsonl|meta\.json)$/)
  if (!m) return undefined
  const a = agentenWelt.liste.find(x => x.id === m[1])
  if (!a) return { deny: 'fehlt' }
  if (m[2] === 'jsonl') return a.gross ? { deny: 'über 4 MiB' } : { value: jsonl(a) }
  return { value: JSON.stringify({ agentType: a.type, description: a.description, finished: a.finished }) }
}

export function haengeAgentenListe(on: On): void {
  on('fs.list', (_$, e) => {
    agentenWelt.listAufrufe++
    const pfad = (e as { path?: string }).path?.replace(/\\/g, '/') ?? ''
    if (!pfad.endsWith('/eigene-sitzung/subagents')) return { deny: 'fehlt' } as never
    const eintraege = agentenWelt.liste.map(a => ({ name: `agent-${a.id}.jsonl`, kind: 'file', size: jsonl(a).length + (a.finished ? 1 : 0), mtimeMs: a.mtimeMs ?? FRISCH, isLink: false }))
    return { value: eintraege } as never
  })
}
