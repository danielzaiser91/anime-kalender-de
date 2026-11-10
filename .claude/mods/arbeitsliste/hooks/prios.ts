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

export const MAX_ZEILEN_PRIO = 4

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

// Zeilen eines Textes bei Umbruch am Leerzeichen (wie Ink); ein Wort über der Breite bricht hart.
export function umbruchZeilen(text: string, breite: number): number {
  let zeilen = 1
  let laenge = 0
  text.split(' ').forEach((wort, i) => {
    const mit = laenge + (i > 0 ? 1 : 0) + wort.length
    if (mit <= breite || laenge === 0) laenge = mit
    else {
      zeilen++
      laenge = wort.length
    }
    if (laenge > breite) {
      zeilen += Math.ceil(laenge / breite) - 1
      laenge -= (Math.ceil(laenge / breite) - 1) * breite
    }
  })
  return zeilen
}

// Gezeichneter Text des Kopfes (Chip, Titel, Kurztext) so, wie bereiche.tsx ihn setzt.
export function kopfText(e: PrioEintrag): string {
  const st = statusVon(e.status)
  return (st ? ` ${st.label}  ${e.titel}` : e.titel) + (e.rest ? ` ${e.rest}` : '')
}

// Zeilen, die Chip, Titel und Kurztext umbrochen brauchen.
export const zeilenBedarf = (e: PrioEintrag, zeichenJeZeile: number): number => umbruchZeilen(kopfText(e), Math.max(8, zeichenJeZeile))

// Passt der Kurztext nicht in MAX_ZEILEN_PRIO Zeilen, steht er nur im Ausklapp-Teil (nie abgeschnitten).
export const textKlappt = (e: PrioEintrag, zeichenJeZeile: number): boolean => zeilenBedarf(e, zeichenJeZeile) > MAX_ZEILEN_PRIO

export const hatAusklapp = (e: PrioEintrag, zeichenJeZeile: number): boolean => e.details.length > 0 || textKlappt(e, zeichenJeZeile)

// Desktop setzt Proportionalschrift: dort passen gut 1,6 Zeichen je Spalte (Screenshot 11.10.2026); Terminal 1.
export const zeichenJeSpalte = (surface: string): number => (surface === 'terminal' ? 1 : 1.6)

// Pane-Rand 2, Kastenrand samt Innenrand 4, Klappknopf 2.
export const PRIO_RAND = 8

export function prioZeichenJeZeile(bodyColumns: number, surface: string): number {
  return Math.floor(Math.max(16, (bodyColumns || 38) - PRIO_RAND) * zeichenJeSpalte(surface))
}
