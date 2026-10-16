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
