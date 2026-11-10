import { genreFehlt } from './tmdb-genre.ts'
import { kinoFehlt } from './tmdb-kino-zuletzt.ts'
import { neusucheFaellig, type Vermerk404 } from './tmdb-folgen-404.ts'

type Eintrag = { tmdbId?: number; kind?: string; genreIds?: number[]; kinoDe?: string[]; fetchedAt?: string }

export type FaelligOptionen = {
  handIds: Set<number>
  nurOhneEintrag: boolean
  force: boolean
  /** Treffer mit Kennung sind älter als diese Zeit fällig. */
  grenze: string
  /** Fehlschläge ohne Kennung werden früher wiedervorgelegt. */
  grenzeFehlschlag: string
  /** Vermerke aus `data/tmdb-folgen-404.json` je Titel: Eintrag mit toter Kennung wird neu gesucht, nicht geparkt. */
  tot?: Record<string, Vermerk404>
  /**
   * Fehlschläge von vor der Film-Nachsuche (`vor`, ISO-Zeit) für Titel, die ein Film sein könnten (`ids`): sie kommen nach den toten Kennungen
   * und vor allem anderen dran, denn nur sie profitieren von der neuen Regel; ein Wochenlauf mit Limit 400 wäre sonst Wochen am Rückstau.
   */
  filmNeusuche?: { ids: ReadonlySet<number>; vor: string }
}

/** Ein Fehlschlag von vor der Film-Nachsuche bei einem möglichen Film. */
function filmNeusucheFaellig(id: number, e: Eintrag | undefined, o: FaelligOptionen): boolean {
  const f = o.filmNeusuche
  return !!f && f.ids.has(id) && !!e && !e.tmdbId && (e.fetchedAt ?? '') < f.vor
}

/** Die Titel, die dieser Lauf neu abfragt: tote Kennungen zuerst, dann ältester Abruf zuerst, nie geholte ganz vorn. */
export function faelligeTitel<T extends { id: number }>(titles: T[], cache: Record<string, Eintrag>, o: FaelligOptionen): T[] {
  /* Tote Kennungen zuerst: sie liefern nichts, solange sie stehen, und ein kleines Limit trifft sie sicher. */
  const tot = (t: { id: number }): boolean => neusucheFaellig(o.tot?.[String(t.id)], cache[t.id])
  return titles
    .filter((t) => {
      /* Was von Hand steht, wird nicht neu gesucht — sonst gewinnt der Fehltreffer wieder. */
      if (o.handIds.has(t.id)) return false
      const e = cache[t.id]
      if (o.nurOhneEintrag) return !e
      if (o.force || !e || kinoFehlt(e) || tot(t) || filmNeusucheFaellig(t.id, e, o)) return true
      /* Ohne Genre zählt wie ein Fehlschlag: bald wieder, aber nicht in jedem Lauf (dauerhaft scheiternder Detailabruf). */
      return (e.fetchedAt ?? '') < (e.tmdbId && !genreFehlt(e) ? o.grenze : o.grenzeFehlschlag)
    })
    .sort(
      (a, b) =>
        Number(tot(b)) - Number(tot(a)) ||
        Number(filmNeusucheFaellig(b.id, cache[b.id], o)) - Number(filmNeusucheFaellig(a.id, cache[a.id], o)) ||
        (cache[a.id]?.fetchedAt ?? '').localeCompare(cache[b.id]?.fetchedAt ?? ''),
    )
}
