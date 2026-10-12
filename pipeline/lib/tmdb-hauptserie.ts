import { darfTrefferErben, folgenzahlen, normalisiereName, type TitelAngabe, type TrefferAngabe } from './treffer-erben.ts'
/**
 * **Ein Special, OVA oder ONA bekommt keine TMDB-Hauptserie als eigene Kennung** (Befund 12.10.2026: der TMDB-Durchlauf ordnete
 * drei aniSearch-Specials — Fate/Stay Night UBW Prologue, SAO Alternative GGO Refrain, Slime: Veldora’s Journal — den Hauptserien
 * tv/61415, 78204 und 82684 zu; sie bekamen im Bau deren Anbieterwege).
 * Die Regel ist die des Baus (`treffer-erben.ts`: Namen oder Folgenzahl müssen passen), hier schon im Sammler und auch für
 * Titel, die der Bau nicht als Medium kennt (aniSearch-only). Rein, ohne Node-APIs.
 */
export interface TmdbEintrag {
  tmdbId?: number
  kind?: 'tv' | 'movie'
  nameDe?: string
}
export interface TitelKurz {
  id: number
  format?: string | null
  episodes?: number | null
  titleEn?: string | null
  titleRomaji?: string | null
}

const KURZFORMEN = new Set(['SPECIAL', 'OVA', 'ONA', 'MUSIC'])
const SERIENFORMEN = new Set(['TV', 'TV_SHORT'])

/** Titel-IDs, deren TMDB-Serie auch ein TV-Titel trägt und die sie nach Namen und Folgenzahl nicht erben dürfen. */
export function findeGeteilteHauptserien(a: {
  titles: TitelKurz[]
  cache: Record<string, TmdbEintrag>
  tmdbFolgen: Record<string, { folgen?: { s: number }[] }>
  /** Von Hand gesetzte Kennungen (`data/tmdb-von-hand.yaml`) bleiben unangetastet. */
  vonHand: Set<number>
}): number[] {
  const serie = (id: number): string | undefined => {
    const e = a.cache[id]
    return e?.tmdbId && e.kind === 'tv' ? String(e.tmdbId) : undefined
  }
  const tvJeSerie = new Map<string, Set<number>>()
  for (const t of a.titles) {
    const k = serie(t.id)
    if (k && SERIENFORMEN.has(t.format ?? '')) tvJeSerie.set(k, (tvJeSerie.get(k) ?? new Set()).add(t.id))
  }
  const hatTvTraeger = (t: TitelKurz): boolean => [...(tvJeSerie.get(serie(t.id)!) ?? [])].some((id) => id !== t.id)
  const gefunden: number[] = []
  for (const t of a.titles) {
    if (!KURZFORMEN.has(t.format ?? '') || !serie(t.id) || a.vonHand.has(t.id) || !hatTvTraeger(t)) continue
    const titel: TitelAngabe = { format: t.format ?? null, episodes: t.episodes ?? null, namen: [normalisiereName(t.titleEn), normalisiereName(t.titleRomaji)] }
    const treffer: TrefferAngabe = {
      art: 'serie',
      namen: [normalisiereName(a.cache[t.id]?.nameDe)],
      folgen: folgenzahlen(a.tmdbFolgen[t.id]?.folgen),
      teiltMitSerie: true,
    }
    if (!darfTrefferErben(titel, treffer)) gefunden.push(t.id)
  }
  return gefunden
}

/** Streicht die Zuordnung samt allem, was an ihr hängt (Handlung, FSK, Anbieter); der Eintrag wird ein Fehlschlag mit Wiedervorlage. */
export function streicheZuordnungen(cache: Record<string, object>, ids: number[], jetzt: string): void {
  for (const id of ids) cache[id] = { miss: true, fetchedAt: jetzt }
}
