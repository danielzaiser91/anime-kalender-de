// „## Top-Prios“ mit Status-Flag (Daniel, 16.10.2026).
// Zeile: `- **Kurztitel** {status} Kurztext [Link](Ziel)`; eingerückte Folgezeilen sind Details (ausklappbar).
import { extrahiereLinks, klartext } from './zaehlen'
import type { Eintrag } from './zaehlen'

export type PrioStatus = { label: string; farbe: string }

// Feste Liste; Farben sind Themenschlüssel (hell und dunkel). Ein unbekanntes Wort zeigt die Oberfläche als „?<wort>“ in Rot, ein fehlendes gar nicht.
export const STATUS: Record<string, PrioStatus> = {
  queue: { label: 'QUEUE', farbe: 'inactive' },
  'arbeit-agent': { label: 'AGENT', farbe: 'suggestion' },
  'arbeit-ich': { label: 'CLAUDE', farbe: 'planMode' },
  pipeline: { label: 'PIPELINE', farbe: 'merged' },
  live: { label: 'LIVE', farbe: 'success' },
  'wartet-daniel': { label: 'DANIEL', farbe: 'warning' },
  blockiert: { label: 'BLOCKIERT', farbe: 'error' },
}

export type PrioEintrag = Eintrag & { status: string; details: string[] }

// Ohne Kennzeichen (Altzeile) kein Chip und keine Fehlerfarbe.
export function statusVon(status: string): PrioStatus | null {
  if (!status) return null
  return STATUS[status] ?? { label: `?${status}`, farbe: 'error' }
}

// Links hinter „ — “ am Zeilenende sind reine Knöpfe; Links mitten im Satz behalten ihren Text.
const KNOPFREIHE = /(?:^|\s)—\s+(?:\[[^\]]+\]\([^)]*\)\s*)+$/
const lesbar = (s: string) => klartext(s.replace(KNOPFREIHE, ''))

// Kopf ohne fetten Titel: ganze Zeile ist der Titel.
function prioKopf(roh: string): PrioEintrag {
  const m = /^\*\*(.+?)\*\*\s*(?:\{([^}]*)\})?\s*(?:—\s*)?(.*)$/.exec(roh)
  const links = extrahiereLinks(roh)
  if (!m) return { titel: lesbar(roh), rest: '', groesse: 'normal', links, status: '', details: [] }
  return { titel: klartext(m[1]!), rest: lesbar(m[3]!), groesse: 'normal', links, status: (m[2] ?? '').trim(), details: [] }
}

// Eingerückte Folgezeile: Text wird Detail, Links wandern zusätzlich in die Knopfzeile.
function ergaenzeDetail(e: PrioEintrag, zeile: string) {
  const roh = zeile.replace(/^\s*(?:-\s+)?/, '')
  const text = lesbar(roh)
  if (text) e.details.push(text)
  for (const v of extrahiereLinks(roh)) if (!e.links.some(l => l.href === v.href)) e.links.push(v)
}

// Zeilen „- “ bis zur nächsten „## “-Überschrift; fehlt der Abschnitt, bleibt die Liste leer.
export function zaehleTopPrios(text: string): PrioEintrag[] {
  const aus: PrioEintrag[] = []
  let drin = false
  for (const zeile of text.split(/\r?\n/)) {
    if (zeile.startsWith('## ')) drin = zeile.startsWith('## Top-Prios')
    else if (drin && zeile.startsWith('- ')) aus.push(prioKopf(zeile.slice(2)))
    else if (drin && aus.length && /^\s+\S/.test(zeile)) ergaenzeDetail(aus[aus.length - 1]!, zeile)
  }
  return aus
}

// Desktop setzt Proportionalschrift: dort passen gut 1,6 Zeichen je Spalte (Screenshot 11.10.2026); Terminal 1.
export const zeichenJeSpalte = (surface: string): number => (surface === 'terminal' ? 1 : 1.6)
