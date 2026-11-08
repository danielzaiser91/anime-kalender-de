import { eigeneId, type EigenerEintrag } from '../bau/eigene-titel.ts'

export type EigeneZuordnung = Record<string, { tmdbId: number; kind: 'tv' | 'movie' }>

/**
 * Die TMDB-Zuordnung der eigenen Titel (`data/eigene-titel.yaml`, Feld `tmdb`) in der Form von `data/tmdb-titles.json`, damit der Plakatlauf
 * (`fetch-tmdb-poster.ts`) sie holt und erneuert. Die Namenssuche (`plakatSuche`) findet sie nie: Ohne Jahr ist jeder Treffer „unsicher“.
 * Widerrufene und umgezogene Zeilen (`zuId`) bleiben draußen.
 */
export function eigeneTmdbZuordnung(eintraege: EigenerEintrag[]): EigeneZuordnung {
  const raus: EigeneZuordnung = {}
  for (const e of eintraege) {
    const [kind, id] = (e.tmdb ?? '').split('/')
    if (!id || e.widerrufen || e.zuId) continue
    raus[String(eigeneId(e.nr))] = { tmdbId: Number(id), kind: kind as 'tv' | 'movie' }
  }
  return raus
}
