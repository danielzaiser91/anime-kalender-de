import { anzeigeName } from '@shared/titles.ts'
import type { Title } from '@shared/types.ts'

/** Ein Vergleicher für alle Sortierungen — `localeCompare` baut ihn bei jedem Aufruf neu. */
const KOLLATOR = new Intl.Collator('de')

/** Ein angekündigter Titel ohne belegte deutsche Fassung (Merkmal `os` vom Bau): gehört hinter den Schalter „ohne deutsche Synchro“. */
export const istOhneBelegteSynchro = (t: Title): boolean => Boolean((t as Title & { os?: boolean }).os)

/** Ein Titel mit seinem vom Bau gerechneten Platz in der Sortierung. */
type MitRang = Title & { tr?: number }

/**
 * Sortiert Gruppen nach dem Namen des Kopfes (deutsche Reihenfolge).
 *
 * **Der Normalfall ist eine Zahl:** Der Bau rechnet jedem Titel seinen Platz `tr` aus (`bau/titel-rang.ts`). Die Plätze sind einmalig, deshalb
 * wird nicht verglichen, sondern eingeordnet: jede Gruppe an ihren Platz, dann der Reihe nach eingesammelt — linear, ohne Vergleicher. Auf einem
 * gedrosselten Handy sind das bei 18.863 Titeln wenige Millisekunden statt 900 (Namensvergleich) oder 150 (Zahlenvergleich), gemessen 07.10.2026.
 * Fehlt `tr` an einem Kopf (ältere Datei im Zwischenspeicher) oder ist ein Platz doppelt, gilt der Namensvergleich mit einmal gebildeten
 * Schlüsseln — dasselbe Ergebnis wie vorher mit `localeCompare('de')`, auch bei Gleichstand (die Sortierung ist stabil).
 */
export function sortiereNachTitel<T extends { main: Title }>(gruppen: T[]): void {
  if (gruppen.every((g) => (g.main as MitRang).tr !== undefined) && ordneNachRang(gruppen)) return
  const name = new Map<T, string>(gruppen.map((g) => [g, anzeigeName(g.main)]))
  gruppen.sort((a, b) => KOLLATOR.compare(name.get(a)!, name.get(b)!))
}

/** Ordnet nach `tr` ein; gibt `false` zurück (und lässt die Liste unberührt), wenn ein Platz zweimal vorkommt. */
function ordneNachRang<T extends { main: Title }>(gruppen: T[]): boolean {
  const platz: (T | undefined)[] = []
  for (const g of gruppen) {
    const r = (g.main as MitRang).tr!
    if (platz[r]) return false
    platz[r] = g
  }
  let k = 0
  for (const g of platz) if (g) gruppen[k++] = g
  return true
}
