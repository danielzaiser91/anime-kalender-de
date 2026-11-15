// Laufende Subagenten der Sitzung aus deren Transkriptordner `<Projekt>/<Sitzungs-ID>/subagents` (Daniel, 15.11.2026: Savvy
// entfällt). Nachbau von `laufendeAgenten` in .claude/hooks/agenten-grenze.js (CommonJS, Import über Modgrenzen geht nicht):
// Regeländerung dort nachführen. Laufend = agent-*.jsonl jünger als eine Stunde, Meta nicht `finished`, letzte Zeile
// nicht der abgegebene Bericht (SubagentHandback) oder TaskStop-Abbruch. Drei Abweichungen von der Grenze:
// (1) Transkript über 4 MiB ($.fs.read liest nur ganz, die Grenze liest den Schwanz): zählt nach mtime, laufend bis 2 min
//     nach der letzten Schreibung; (2) unlesbare letzte Zeile: wie dort nicht gezählt, hier zusätzlich als Fehler gemeldet;
// (3) Prüfer erkennt `pruefer.ts` auch an der Beschreibung „Prüfer…“, die Grenze nur am Typ.
export type LaufAgent = { id: string; type: string; description: string; start: number | null }
type Eintrag = { name: string; mtimeMs: number; size: number }
type Dateien = { list: (p: string) => Promise<Eintrag[]>; read: (p: string) => Promise<unknown> }
// Zwischenspeicher je Datei: unverändert (mtime und Größe der jsonl gleich) wird sie nicht erneut gelesen; `geprueft` =
// Zeitpunkt der letzten Lesung. Die Meta (klein) wird dagegen bei jedem Takt gelesen: `finished` kommt nach der letzten Schreibung.
export type AgentenCache = Map<string, { key: string; agent: LaufAgent | null; geprueft: number }>
export type Zaehlung = { agenten: LaufAgent[]; fehler: string[] }

const FRISCH_MS = 60 * 60 * 1000
// Über 4 MiB lässt sich das Transkript nicht lesen ($.fs.read): dann gilt „läuft“, solange es noch geschrieben wird.
const GROSS_BYTES = 4 * 1024 * 1024
const GROSS_FRISCH_MS = 2 * 60 * 1000
// Ein wachsendes Transkript wird höchstens alle 15 s ganz gelesen (bis 4 MiB je Lesung), dazwischen gilt das letzte Urteil.
export const LESE_ABSTAND_MS = 15_000

// Projektordner heißt wie der Arbeitsordner, jedes Zeichen außer Buchstaben und Ziffern wird „-“.
export const projektName = (cwd: string): string => cwd.replace(/[^A-Za-z0-9]/g, '-')

const meldung = (e: unknown): string => String((e as { message?: string })?.message ?? e)
const istFehlt = (e: unknown): boolean => /ENOENT|no such file|not found|does not exist/i.test(meldung(e))

export function istBericht(zeile: string): boolean {
  const e = JSON.parse(zeile) as { type?: string; message?: { content?: unknown } }
  const text = JSON.stringify(e.message?.content ?? '')
  return e.type === 'user' && (text.includes('Report delivered to your caller') || text.includes('interrupted'))
}

type Meta = { agentType?: string; description?: string; finished?: boolean }
type Urteil = { agent: LaufAgent | null; fehler?: string; merken: boolean }

// Fehlende Meta ist normal (Typ „?“); eine unlesbare wird gemeldet.
async function lieseMeta(d: Dateien, pfad: string, fehler: string[]): Promise<Meta> {
  let roh: string
  try {
    roh = (await d.read(pfad.replace(/\.jsonl$/, '.meta.json'))) as string
  } catch (e) {
    if (!istFehlt(e)) fehler.push(`Meta ${pfad}: ${meldung(e)}`)
    return {}
  }
  try {
    return JSON.parse(roh)
  } catch (e) {
    fehler.push(`Meta ${pfad}: ${meldung(e)}`)
    return {}
  }
}

async function pruefeDatei(d: Dateien, pfad: string, f: Eintrag, jetzt: number, meta: Meta, alt: LaufAgent | null | undefined): Promise<Urteil> {
  const agent = (start: number | null): LaufAgent => ({ id: f.name.slice(6, -6), type: meta.agentType || '?', description: meta.description || '', start })
  if (f.size > GROSS_BYTES) return { agent: jetzt - f.mtimeMs > GROSS_FRISCH_MS ? null : agent(alt?.start ?? jetzt), merken: true }
  let text: string
  try {
    text = (await d.read(pfad)) as string
  } catch (e) {
    return { agent: null, fehler: `Transkript ${pfad}: ${meldung(e)}`, merken: false }
  }
  const zeilen = text.split('\n').filter(z => z.trim())
  if (!zeilen.length) return { agent: null, merken: true }
  try {
    if (istBericht(zeilen[zeilen.length - 1] as string)) return { agent: null, merken: true }
  } catch (e) {
    return { agent: null, fehler: `Letzte Zeile ${pfad}: ${meldung(e)}`, merken: false }
  }
  try {
    const start = Date.parse((JSON.parse(zeilen[0] as string) as { timestamp?: string }).timestamp ?? '')
    return { agent: agent(Number.isNaN(start) ? (alt?.start ?? jetzt) : start), merken: true }
  } catch (e) {
    return { agent: agent(alt?.start ?? jetzt), fehler: `Erste Zeile ${pfad}: ${meldung(e)}`, merken: false }
  }
}

async function liste(d: Dateien, ordner: string, jetzt: number, fehler: string[]): Promise<Eintrag[] | null> {
  try {
    return (await d.list(ordner)).filter(f => /^agent-.*\.jsonl$/.test(f.name) && jetzt - f.mtimeMs <= FRISCH_MS)
  } catch (e) {
    if (!istFehlt(e)) fehler.push(`Ordner ${ordner}: ${meldung(e)}`)
    return null
  }
}

// Ordner fehlt (ENOENT): keine Agenten, kein Fehler; jeder andere Fehler steht in `fehler`, nichts davon wird gemerkt.
export async function lieseLaufende(d: Dateien, ordner: string, jetzt: number, cache: AgentenCache): Promise<Zaehlung> {
  const fehler: string[] = []
  const eintraege = await liste(d, ordner, jetzt, fehler)
  if (!eintraege) {
    cache.clear()
    return { agenten: [], fehler }
  }
  const heute = new Set(eintraege.map(f => f.name))
  for (const name of cache.keys()) if (!heute.has(name)) cache.delete(name)
  const agenten: LaufAgent[] = []
  for (const f of eintraege) {
    const pfad = `${ordner}/${f.name}`
    const meta = await lieseMeta(d, pfad, fehler)
    if (meta.finished) {
      cache.delete(f.name)
      continue
    }
    const key = `${f.mtimeMs}:${f.size}`
    const bekannt = cache.get(f.name)
    const aktuell = bekannt && (bekannt.key === key || jetzt - bekannt.geprueft < LESE_ABSTAND_MS)
    const urteil: Urteil = aktuell ? { agent: bekannt.agent, merken: false } : await pruefeDatei(d, pfad, f, jetzt, meta, bekannt?.agent)
    // Ein Fehlurteil wird nie gemerkt: der alte Eintrag hat einen anderen Schlüssel und ist älter als der Lese-Abstand.
    if (urteil.fehler) fehler.push(urteil.fehler)
    else if (urteil.merken) cache.set(f.name, { key, agent: urteil.agent, geprueft: jetzt })
    if (urteil.agent) agenten.push({ ...urteil.agent, type: meta.agentType || '?', description: meta.description || '' })
  }
  return { agenten: agenten.sort((a, b) => (a.start ?? 0) - (b.start ?? 0)), fehler }
}

// „<1 min“, „12 min“, „1 h 05 min“; ohne bekannten Start „–“.
export function laufzeitText(start: number | null, jetzt: number): string {
  if (start === null) return '–'
  const min = Math.max(0, Math.floor((jetzt - start) / 60_000))
  if (min < 1) return '<1 min'
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`
}
