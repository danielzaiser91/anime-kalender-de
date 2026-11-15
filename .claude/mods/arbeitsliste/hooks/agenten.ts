// Laufende Subagenten der Sitzung aus deren Transkriptordner `<Projekt>/<Sitzungs-ID>/subagents` (Daniel, 15.11.2026: Savvy
// entfällt). Nachbau von `laufendeAgenten` in .claude/hooks/agenten-grenze.js (CommonJS, Import über Modgrenzen geht nicht):
// Regel dort ändern, hier nachführen. Laufend = agent-*.jsonl jünger als eine Stunde, Meta nicht `finished`, letzte Zeile
// nicht der abgegebene Bericht (SubagentHandback) oder TaskStop-Abbruch.
export type LaufAgent = { id: string; type: string; description: string; start: number | null }
type Eintrag = { name: string; mtimeMs: number; size: number }
type Dateien = { list: (p: string) => Promise<Eintrag[]>; read: (p: string) => Promise<unknown> }
// Zwischenspeicher je Datei: unverändert (mtime und Größe gleich) wird nichts neu gelesen.
export type AgentenCache = Map<string, { key: string; agent: LaufAgent | null }>

const FRISCH_MS = 60 * 60 * 1000
// Über 4 MiB lässt sich das Transkript nicht lesen ($.fs.read): dann gilt „läuft“, solange es noch geschrieben wird.
const GROSS_FRISCH_MS = 2 * 60 * 1000

// Projektordner heißt wie der Arbeitsordner, jedes Zeichen außer Buchstaben und Ziffern wird „-“.
export const projektName = (cwd: string): string => cwd.replace(/[^A-Za-z0-9]/g, '-')

export function istBericht(zeile: string): boolean {
  try {
    const e = JSON.parse(zeile) as { type?: string; message?: { content?: unknown } }
    const text = JSON.stringify(e.message?.content ?? '')
    return e.type === 'user' && (text.includes('Report delivered to your caller') || text.includes('interrupted'))
  } catch {
    return false
  }
}

async function lieseMeta(d: Dateien, pfad: string): Promise<{ agentType?: string; description?: string; finished?: boolean }> {
  try {
    return JSON.parse((await d.read(pfad.replace(/\.jsonl$/, '.meta.json'))) as string)
  } catch {
    return {}
  }
}

async function pruefeDatei(d: Dateien, ordner: string, f: Eintrag, jetzt: number, alt: LaufAgent | null | undefined): Promise<LaufAgent | null> {
  const pfad = `${ordner}/${f.name}`
  const meta = await lieseMeta(d, pfad)
  if (meta.finished) return null
  const agent = (start: number | null): LaufAgent => ({ id: f.name.slice(6, -6), type: meta.agentType || '?', description: meta.description || '', start })
  let text: string
  try {
    text = (await d.read(pfad)) as string
  } catch {
    return jetzt - f.mtimeMs > GROSS_FRISCH_MS ? null : agent(alt?.start ?? jetzt)
  }
  const zeilen = text.split('\n').filter(z => z.trim())
  if (!zeilen.length || istBericht(zeilen[zeilen.length - 1] as string)) return null
  const start = Date.parse((JSON.parse(zeilen[0] as string) as { timestamp?: string }).timestamp ?? '')
  return agent(Number.isNaN(start) ? (alt?.start ?? jetzt) : start)
}

// Ordner fehlt oder ist unlesbar: keine Agenten.
export async function lieseLaufende(d: Dateien, ordner: string, jetzt: number, cache: AgentenCache): Promise<LaufAgent[]> {
  let eintraege: Eintrag[]
  try {
    eintraege = (await d.list(ordner)).filter(f => /^agent-.*\.jsonl$/.test(f.name) && jetzt - f.mtimeMs <= FRISCH_MS)
  } catch {
    cache.clear()
    return []
  }
  const heute = new Set(eintraege.map(f => f.name))
  for (const name of cache.keys()) if (!heute.has(name)) cache.delete(name)
  const aus: LaufAgent[] = []
  for (const f of eintraege) {
    const key = `${f.mtimeMs}:${f.size}`
    const bekannt = cache.get(f.name)
    const agent = bekannt?.key === key ? bekannt.agent : await pruefeDatei(d, ordner, f, jetzt, bekannt?.agent).catch(() => null)
    cache.set(f.name, { key, agent })
    if (agent) aus.push(agent)
  }
  return aus.sort((a, b) => (a.start ?? 0) - (b.start ?? 0))
}

// „<1 min“, „12 min“, „1 h 05 min“; ohne bekannten Start „–“.
export function laufzeitText(start: number | null, jetzt: number): string {
  if (start === null) return '–'
  const min = Math.max(0, Math.floor((jetzt - start) / 60_000))
  if (min < 1) return '<1 min'
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`
}
