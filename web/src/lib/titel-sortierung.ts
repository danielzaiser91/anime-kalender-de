import { anzeigeName } from '@shared/titles.ts'
import type { Title } from '@shared/types.ts'

/** Ein Vergleicher für alle Sortierungen — `localeCompare` baut ihn bei jedem Aufruf neu. */
const KOLLATOR = new Intl.Collator('de')

/**
 * Sortiert Gruppen nach dem Namen des Kopfes, wie vorher mit `localeCompare('de')`, nur ohne den Namen bei jedem Vergleich neu zu bilden
 * und ohne neuen Vergleicher je Aufruf: bei 18.863 Titeln 598 → 51 ms am Desktop (07.10.2026; auf einem Handy mit Drosselung war es ein Block von
 * mehreren Sekunden). Das Ergebnis ist dasselbe, auch bei Gleichstand (die Sortierung ist stabil).
 */
export function sortiereNachTitel<T extends { main: Title }>(gruppen: T[]): void {
  const name = new Map<T, string>(gruppen.map((g) => [g, anzeigeName(g.main)]))
  gruppen.sort((a, b) => KOLLATOR.compare(name.get(a)!, name.get(b)!))
}
