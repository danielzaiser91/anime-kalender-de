import { mock } from 'claude-code/testing'
import type { On } from 'claude-code'

export const STAND = `# Stand
## In Arbeit (Stand 10.10.2026)

- **Patchnotes ohne Footer, Kopfzeile 64 statt 96 px, Rooster Fighter bei Netflix mit Link** — Code fertig und geprüft, **noch nicht live**: Commit wartet.
- **Prüfliste Rooster Fighter (Netflix)** — erst nach dem Bestandsbau möglich.
- **Impressum-Anschrift eintragen (Daniel, 10.10. 12:27)** — Verifizierung abgeschlossen. Erste Aufgabe der nächsten Sitzung.
- **Autonomer Modus** — aus (Daniel stoppte 12:17).

## Als Nächstes (Todo)

- Fahrplan 1: Wecker-Wache ausliefern und prüfen, Monatswache.
- Fahrplan 2: Register der Zugänge und Token samt Ablaufwächter.
- Fahrplan 3 und 4: Wachen-Urteil als Claude-Lauf; Invarianten am Bau-Ergebnis.
- Fahrplan 6 bis 9: Sammelartikel abbauen, Crunchyroll-Lineup lesen, Doppelbau verengen, Wiedervorlage nach Alter.
- Live-Messungen für die Handy-Prüfungen in [stand.md](stand.md).
- Ursache des kaputten Bash-PATH finden (Elternprozess).
- Kontext weiter kürzen — wartet auf deine Entscheidung (MCP-Server, Skills, Regeldateien).
`

export const PANE = {
  plugin: 'arbeitsliste',
  component: 'Pane',
  requestId: 'arbeitsliste',
  props: { title: 'Arbeitsliste', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

export const BAND = {
  plugin: 'arbeitsliste',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 9 }, view: {} },
} as const

// Sichtbarer Text eines Baums, zeilenweise (Box in Spaltenrichtung trennt Zeilen).
export function zeilen(knoten: unknown, aus: string[] = [], zeile = { s: '' }): string[] {
  if (typeof knoten === 'string') { zeile.s += knoten; return aus }
  if (!knoten || typeof knoten !== 'object') return aus
  const k = knoten as { type?: string; props?: Record<string, unknown>; children?: unknown[] }
  const kinder = k.children ?? (k.props?.children as unknown[] | undefined) ?? []
  const spalte = k.type === 'Box' && k.props?.flexDirection === 'column'
  if (k.type === 'Button' && typeof k.props?.label === 'string' && kinder.length === 0) zeile.s += k.props.label
  for (const kind of Array.isArray(kinder) ? kinder : [kinder]) {
    if (spalte) {
      const z = { s: '' }
      zeilen(kind, aus, z)
      if (z.s.trim()) aus.push(z.s)
    } else zeilen(kind, aus, zeile)
  }
  return aus
}

// Baum nach Elementen mit gesetztem Prop durchsuchen.
export function hat(knoten: unknown, prop: string, wert: unknown): boolean {
  if (!knoten || typeof knoten !== 'object') return false
  const k = knoten as { props?: Record<string, unknown>; children?: unknown[] }
  if (k.props?.[prop] === wert) return true
  const kinder = k.children ?? (k.props?.children as unknown[] | undefined) ?? []
  return (Array.isArray(kinder) ? kinder : [kinder]).some(c => hat(c, prop, wert))
}

// Reiner Text eines Knotens, ohne Zeilenumbrüche.
export function klartextVon(knoten: unknown): string {
  if (typeof knoten === 'string') return knoten
  if (!knoten || typeof knoten !== 'object') return ''
  const k = knoten as { props?: Record<string, unknown>; children?: unknown[] }
  const kinder = k.children ?? (k.props?.children as unknown[] | undefined) ?? []
  return (Array.isArray(kinder) ? kinder : [kinder]).map(klartextVon).join('')
}

// Kennungen aller Bereichsköpfe, die gerade zu sind (Label beginnt mit ▸).
export function zuBereiche(knoten: unknown, aus: string[] = []): string[] {
  if (!knoten || typeof knoten !== 'object') return aus
  const k = knoten as { type?: string; props?: Record<string, unknown>; children?: unknown[] }
  const key = String(k.props?.key ?? '')
  if (k.type === 'Button' && key.startsWith('bereich:') && String(k.props?.label).startsWith('▸')) aus.push(key)
  const kinder = k.children ?? (k.props?.children as unknown[] | undefined) ?? []
  for (const c of Array.isArray(kinder) ? kinder : [kinder]) zuBereiche(c, aus)
  return aus
}

// Die meisten Pane-Tests prüfen Inhalt: Standard ist eingeklappt (außer Jetzt), also erst alles aufklappen.
export async function oeffneAlle(pane: { drawn: () => Promise<unknown>; press: (e: { key: string }) => Promise<unknown> }) {
  for (const key of zuBereiche(await pane.drawn())) await pane.press({ key })
}

// Autonomer Modus: je Sitzung eine Datei. Die Testsitzung ist SITZUNG; fremde Dateien (und die alte globale) liegen mit Endzeit vor.
const MARKER_ORDNER = 'C:/Users/ih/.claude/autonomer-modus'
const SITZUNG = 'eigene-sitzung'
const FREMDE_MARKER = [`${MARKER_ORDNER}/fremde-sitzung.txt`, 'C:/Users/ih/.claude/autonomer-modus-bis.txt']

// `engine`: unterste Leiste wie im Betrieb, wenn kein fremdes Modul zeichnet.
export function starte(on: On, marker: string | null, status: (string | undefined)[] = [], engine = true, stand = STAND, ruhe: boolean | string = false, agenten = 0, pruefer = 0, spar = false) {
  mock.clock(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.id', () => ({ value: SITZUNG }) as never)
  on('ui.status', ($, e) => { status.push((e as { text?: string }).text); return { value: undefined } as never })
  if (agenten) {
    const laeuft = Array.from({ length: agenten }, (_, i) => ({ description: i < pruefer ? 'Prüfer: x' : 'Bauer', status: 'running' }))
    on('state.get', (_$, e, next) => ((e as { plugin?: string }).plugin === 'savvy-progress' ? ({ value: { value: laeuft, version: 1 } } as never) : next(e)))
  }
  if (engine) on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'engine', ref: 0 }) as never)
  on('fs.read', ($, e) => {
    // Der Pfad kommt mit Rückwärtsschrägstrichen an (Windows).
    const pfad = e.path.replace(/\\/g, '/')
    if (pfad.endsWith('stand.md')) return { value: stand } as never
    if (marker !== null && pfad === `${MARKER_ORDNER}/${SITZUNG}.txt`) return { value: marker } as never
    if (FREMDE_MARKER.includes(pfad)) return { value: new Date(Date.now() + 3_600_000).toISOString() } as never
    if (ruhe !== false && e.path.endsWith('ruhemodus.txt')) return { value: ruhe === true ? '' : ruhe } as never
    if (spar && e.path.endsWith('sparmodus.txt')) return { value: '' } as never
    return { deny: 'fehlt' } as never
  })
}
