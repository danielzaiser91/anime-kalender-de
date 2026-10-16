// „## Top-Prios“ mit Status-Flag (Daniel, 16.10.2026).
// Zeile: `- **Kurztitel** {status} Kurztext [Link](Ziel)`; eingerückte Folgezeilen sind Details (ausklappbar).
import { extrahiereLinks, klartext } from './zaehlen'
import type { Eintrag } from './zaehlen'

export type PrioStatus = { label: string; farbe: string }

// Feste Liste; Farben sind Themenschlüssel (hell und dunkel). Ein unbekanntes Wort zeigt die Oberfläche als „?<wort>“ in Rot, ein fehlendes gar nicht.
export const STATUS: Record<string, PrioStatus> = {
  queue: { label: 'QUEUE', farbe: 'inactive' },
  'arbeit-agent': { label: 'AGENT', farbe: 'suggestion' },
  'arbeit-ich': { label: 'ICH', farbe: 'claude' },
  pipeline: { label: 'PIPELINE', farbe: 'merged' },
  live: { label: 'LIVE', farbe: 'success' },
  'wartet-daniel': { label: 'DANIEL', farbe: 'warning' },
  blockiert: { label: 'BLOCKIERT', farbe: 'error' },
}

export type PrioEintrag = Eintrag & { status: string; details: string[] }

export const MAX_ZEILEN_PRIO = 4

// Ohne Kennzeichen (Altzeile) kein Chip und keine Fehlerfarbe.
export function statusVon(status: string): PrioStatus | null {
  if (!status) return null
  return STATUS[status] ?? { label: `?${status}`, farbe: 'error' }
}

const ohneLinks = (s: string) => s.replace(/\[[^\]]+\]\([^)]*\)/g, ' ')

// Kopf ohne fetten Titel: ganze Zeile ist der Titel.
function prioKopf(roh: string): PrioEintrag {
  const m = /^\*\*(.+?)\*\*\s*(?:\{([^}]*)\})?\s*(?:—\s*)?(.*)$/.exec(roh)
  const links = extrahiereLinks(roh)
  if (!m) return { titel: klartext(ohneLinks(roh)), rest: '', groesse: 'normal', links, status: '', details: [] }
  const rest = klartext(ohneLinks(m[3]!)).replace(/\s*—$/, '')
  return { titel: klartext(m[1]!), rest, groesse: 'normal', links, status: (m[2] ?? '').trim(), details: [] }
}

// Eingerückte Folgezeile: Text wird Detail, Links wandern in die Knopfzeile.
function ergaenzeDetail(e: PrioEintrag, zeile: string) {
  const roh = zeile.replace(/^\s*(?:-\s+)?/, '')
  const text = klartext(ohneLinks(roh))
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

// Zeilen, die Chip, Titel und Kurztext umbrochen brauchen; Chip, Leerzeichen und Rand zählen mit.
export function zeilenBedarf(e: PrioEintrag, zeichenJeZeile: number): number {
  const zeichen = (statusVon(e.status)?.label.length ?? -3) + 3 + e.titel.length + (e.rest ? e.rest.length + 1 : 0)
  return Math.ceil(zeichen / Math.max(8, zeichenJeZeile))
}

// Passt der Kurztext nicht in MAX_ZEILEN_PRIO Zeilen, steht er nur im Ausklapp-Teil (nie abgeschnitten).
export const textKlappt = (e: PrioEintrag, zeichenJeZeile: number): boolean => zeilenBedarf(e, zeichenJeZeile) > MAX_ZEILEN_PRIO

export const hatAusklapp = (e: PrioEintrag, zeichenJeZeile: number): boolean => e.details.length > 0 || textKlappt(e, zeichenJeZeile)
