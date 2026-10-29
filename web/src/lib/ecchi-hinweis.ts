import type { Dataset } from './data.ts'
import { versteckteEcchi } from './ecchi.ts'
import { filterTitles, type FilterState } from './filters.ts'
import { istOhneBelegteSynchro } from './titel-sortierung.ts'

/**
 * Wie viele ausgeblendete Ecchi-Titel die Suche der Datenbank treffen würde — gleiche Filter und gleiche Suche wie die Liste.
 * Ohne Suchbegriff 0: Der Hinweis steht nur, wenn die Suche etwas Verstecktes findet.
 */
export function zaehleVersteckteEcchiTreffer(data: Dataset, filters: FilterState, heute: string, favorites: Set<number>, ohneSynchro: boolean): number {
  if (!filters.search.trim()) return 0
  const kandidaten = versteckteEcchi().filter((t) => ohneSynchro || !istOhneBelegteSynchro(t))
  return filterTitles(kandidaten, data, filters, heute, favorites).length
}
