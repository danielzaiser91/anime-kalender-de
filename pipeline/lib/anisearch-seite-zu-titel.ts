/** Titel, die nur bei aniSearch stehen, tragen `10.000.000 + aniSearch-Kennung` (`bau/anisearch-titel.ts`). */
const ANISEARCH_AB = 10_000_000

/**
 * Welche archivierte aniSearch-Seite gehört zu welchem Titel: AniList-Titel über `data/anisearch.json`
 * (`anisearchId`), reine aniSearch-Titel über ihre Kennung selbst — sie stehen nie in `anisearch.json`.
 */
export function seiteZuTitel(
  anisearch: Record<string, { anisearchId?: number }>,
  titelIds: Iterable<number>,
): Map<number, number> {
  const zuordnung = new Map<number, number>()
  for (const [id, e] of Object.entries(anisearch)) {
    if (e.anisearchId) zuordnung.set(e.anisearchId, Number(id))
  }
  for (const id of titelIds) {
    if (id >= ANISEARCH_AB) zuordnung.set(id - ANISEARCH_AB, id)
  }
  return zuordnung
}
