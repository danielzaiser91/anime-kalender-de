import type { WikiListen } from './tv-termine.ts'

export type AnisearchFolgen = Record<string, { folgen?: { nr: number; de?: string; datum?: string }[] }>

/** Deutsche aniSearch-Folgentitel je Titel (Schlüssel = Titel-ID); `kennungen` ordnet Titel-ID → aniSearch-Kennung zu. */
export function anisearchFolgenListe(kennungen: Map<string, number>, folgen: AnisearchFolgen): WikiListen {
  return Object.fromEntries(
    [...kennungen].flatMap(([id, asId]) => {
      const mit = (folgen[String(asId)]?.folgen ?? [])
        .filter((f) => f.de)
        .map((f) => ({ nr: f.nr, dt: f.de!, ...(f.datum ? { ead: f.datum.slice(0, 10) } : {}) }))
      return mit.length ? [[id, { seite: 'aniSearch', url: `https://www.anisearch.de/anime/${asId}/episodes`, folgen: mit }] as const] : []
    }),
  )
}

/** Kennungen aus der Tabelle (`data/anisearch.json`, nur AniList-Schlüssel), ergänzt um die des Titels selbst — reine aniSearch-Titel stehen nur dort. */
export function kennungenVereint(tabelle: Record<string, { anisearchId?: number }>, ausTiteln: Map<number, number>): Map<string, number> {
  const m = new Map<string, number>()
  for (const [id, x] of Object.entries(tabelle)) if (x.anisearchId) m.set(id, x.anisearchId)
  for (const [id, asId] of ausTiteln) m.set(String(id), asId)
  return m
}
