/**
 * Die Brücke MAL → aniSearch, wie aniSearch sie selbst führt (`GET /v1/anime/associated?source=myanimelist`, Antwort `{ "<MAL>": [<aniSearch>, …] }`).
 * Ein Beleg von aniSearch, kein Namensabgleich. Behalten wird nur, was sich in beide Richtungen eindeutig verhält: eine MAL-Kennung mit genau einer
 * aniSearch-Kennung, und diese aniSearch-Kennung gehört genau einer MAL-Kennung. Alles andere bleibt auf der Liste `data/anisearch-offen.json`.
 */
export function eindeutigePaare(roh: Record<string, number[]>): Record<string, number> {
  const proAnisearch = new Map<number, number>()
  for (const ids of Object.values(roh)) for (const id of ids) proAnisearch.set(id, (proAnisearch.get(id) ?? 0) + 1)
  const raus: Record<string, number> = {}
  for (const mal of Object.keys(roh).sort((a, b) => Number(a) - Number(b))) {
    const ids = roh[mal]!
    if (ids.length === 1 && proAnisearch.get(ids[0]!) === 1) raus[mal] = ids[0]!
  }
  return raus
}
