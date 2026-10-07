import { anzeigeName } from '@shared/titles.ts'
import type { Title } from '@shared/types.ts'

/** Ein Vergleicher für alle Sortierungen — `localeCompare` baut ihn bei jedem Aufruf neu. */
const KOLLATOR = new Intl.Collator('de')

/**
 * Sortiert Gruppen nach dem Namen des Kopfes (deutsche Reihenfolge).
 *
 * **Der Normalfall ist eine Zahl:** Der Bau rechnet jedem Titel seinen Platz `tr` aus (`bau/titel-rang.ts`); dann genügt ein Zahlenvergleich.
 * Das ist der Unterschied zwischen 900 ms und wenigen Millisekunden bei 18.863 Titeln auf einem gedrosselten Handy (07.10.2026).
 * Fehlt `tr` an einem Kopf (ältere Datei im Zwischenspeicher), gilt der Namensvergleich mit einmal gebildeten Schlüsseln — dasselbe
 * Ergebnis wie vorher mit `localeCompare('de')`, auch bei Gleichstand (die Sortierung ist stabil).
 */
/** Ein Titel mit seinem vom Bau gerechneten Platz in der Sortierung. */
type MitRang = Title & { tr?: number }

export function sortiereNachTitel<T extends { main: Title }>(gruppen: T[]): void {
  if (gruppen.every((g) => (g.main as MitRang).tr !== undefined)) {
    gruppen.sort((a, b) => (a.main as MitRang).tr! - (b.main as MitRang).tr!)
    return
  }
  const name = new Map<T, string>(gruppen.map((g) => [g, anzeigeName(g.main)]))
  gruppen.sort((a, b) => KOLLATOR.compare(name.get(a)!, name.get(b)!))
}
