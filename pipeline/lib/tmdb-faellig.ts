import { genreFehlt } from './tmdb-genre.ts'
import { kinoFehlt } from './tmdb-kino-zuletzt.ts'

type Eintrag = { tmdbId?: number; kind?: string; genreIds?: number[]; kinoDe?: string[]; fetchedAt?: string }

export type FaelligOptionen = {
  handIds: Set<number>
  nurOhneEintrag: boolean
  force: boolean
  /** Treffer mit Kennung sind älter als diese Zeit fällig. */
  grenze: string
  /** Fehlschläge ohne Kennung werden früher wiedervorgelegt. */
  grenzeFehlschlag: string
}

/** Die Titel, die dieser Lauf neu abfragt: ältester Abruf zuerst, nie geholte ganz vorn. */
export function faelligeTitel<T extends { id: number }>(titles: T[], cache: Record<string, Eintrag>, o: FaelligOptionen): T[] {
  return titles
    .filter((t) => {
      /* Was von Hand steht, wird nicht neu gesucht — sonst gewinnt der Fehltreffer wieder. */
      if (o.handIds.has(t.id)) return false
      const e = cache[t.id]
      if (o.nurOhneEintrag) return !e
      if (o.force || !e || kinoFehlt(e) || genreFehlt(e)) return true
      return (e.fetchedAt ?? '') < (e.tmdbId ? o.grenze : o.grenzeFehlschlag)
    })
    .sort((a, b) => (cache[a.id]?.fetchedAt ?? '').localeCompare(cache[b.id]?.fetchedAt ?? ''))
}
