/**
 * Bilanz entlang der Phasenfolge: Zahl der Titel, Termine-Quellen (Releases) und Termine (Events) nach einer
 * Phase. Hat eine Phase ihre Eingabe nicht leer bekommen und liefert leer zurück, bricht der Bau ab —
 * bisher war der Weg von Phase zu Phase nur typgeprüft (Bauer 2016, 25.10.2026).
 */
import { log } from '../lib/util.ts'

export type Bilanz = {
  phase: string
  titel: number
  releases: number
  /** `undefined` vor der Terminphase. */
  events?: number
  /** Kuratierte Einträge (Eingabe der Releases): sind welche da, darf `releases` nicht leer sein. */
  kuratiert: number
}

/** Der erste Widerspruch der Bilanz, sonst `null`. */
export function bilanzFehler(b: Bilanz): string | null {
  if (b.titel === 0) return 'keine Titel'
  if (b.kuratiert > 0 && b.releases === 0) return `${b.kuratiert} kuratierte Einträge, aber keine Releases`
  if (b.releases > 0 && b.events === 0) return `${b.releases} Releases, aber keine Termine`
  return null
}

export function bilanzZeile(b: Bilanz): string {
  return `Bilanz ${b.phase}: ${b.titel} Titel, ${b.releases} Releases, ${b.events ?? '-'} Termine (${b.kuratiert} kuratiert)`
}

/** Druckt die Bilanzzeile und wirft bei einem Widerspruch. */
export function meldeBilanz(b: Bilanz): void {
  log(bilanzZeile(b))
  const fehler = bilanzFehler(b)
  if (fehler) throw new Error(`Phase ${b.phase} lieferte leer: ${fehler}`)
}
