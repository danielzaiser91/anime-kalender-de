/**
 * Grenzdatei der Kalender-Plausibilität: Treffer je Regel dürfen nur sinken. Reine Funktionen mit Datei als Parameter,
 * damit `check-kalender-plausibilitaet.ts` (check:logic) den Wächter mit Kulisse prüfen kann.
 */
import { writeFileSync } from 'node:fs'
import { gesenkt, zuViel } from '../../tools/design-klassen.mjs'
import { panelLink, REGELN, type Regel, type Treffer } from './kalender-plausibilitaet.ts'

const HINWEIS = 'Wird nur vom Bestandsbau gesenkt (tools/commit-data.sh, --festschreiben), nie von Hand erhöht. Ausgangswerte 16.10.2026.'

export interface Grenzen {
  _hinweis: string
  vorkommen: Partial<Record<Regel, number>>
  /** Die Schlüssel der erlaubten Treffer: Was hier fehlt, nennt die Ausgabe als neu. */
  bekannt: Partial<Record<Regel, string[]>>
}

export type TrefferJeRegel = Record<Regel, Treffer[]>

export const zeile = (t: Treffer) => `    ${t.text} — ${panelLink(t.titleId)}`

/** Je Regel mit zu vielen Treffern ein Fehlerblock (nennt die neuen Treffer); leer = grün. */
export function ueberschreitungen(treffer: TrefferJeRegel, grenzen: Grenzen): string[] {
  const fehler: string[] = []
  for (const r of REGELN) {
    const erlaubt = grenzen.vorkommen[r] ?? 0
    if (treffer[r].length <= erlaubt) continue
    const bekannt = new Set(grenzen.bekannt[r] ?? [])
    const neu = treffer[r].filter((t) => !bekannt.has(t.schluessel))
    fehler.push(`${r} hat ${treffer[r].length - erlaubt} Treffer mehr. Neu:\n${(neu.length ? neu : treffer[r]).map(zeile).join('\n')}`)
  }
  return fehler
}

/** Schreibt gesunkene Zahlen und die aktuellen Schlüssel in `datei`; bei einem Anstieg unverändert und mit den betroffenen Regeln als Rückgabe. */
export function festschreiben(treffer: TrefferJeRegel, alt: Grenzen, datei: string): string[] {
  const zahlen = Object.fromEntries(REGELN.map((r) => [r, treffer[r].length]))
  const zuhoch = zuViel(zahlen, alt.vorkommen)
  if (zuhoch.length) return zuhoch
  const vorkommen = gesenkt(zahlen, alt.vorkommen)
  const bekannt = Object.fromEntries(REGELN.map((r) => [r, treffer[r].map((t) => t.schluessel)]))
  writeFileSync(datei, JSON.stringify({ _hinweis: HINWEIS, vorkommen, bekannt }, null, 2) + '\n')
  return []
}
