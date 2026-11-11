import type { TmdbTitle } from '../fetch-tmdb-titles.ts'

export interface VonHandEintrag {
  anilistId: number
  tmdbId?: number
  kind?: 'tv' | 'movie'
  /** Der Titel hat bei TMDB keinen eigenen Eintrag: gespeicherte Kennung entfällt, der Namensabgleich sucht ihn nicht mehr. */
  ohne?: true
}

/** Tabellen, die je AniList-ID an der TMDB-Kennung hängen; `verworfen` sammelt, was die Handzeilen daraus gestrichen haben. */
export interface Abgeleitet {
  banner: Record<string, unknown>
  folgen: Record<string, { tmdbId?: number }>
  /** Ein Titel mit Staffel-0-Zuordnung trägt das Standbild seiner Folge, kein Serienbanner: sein Banner bleibt. */
  staffel0: Record<string, unknown>
  verworfen: string[]
}

/** Streicht Banner (hängt ohne Kennung am Titel) und Folgen einer anderen Kennung als `neu`; `neu` leer = Kennung entfällt. */
function streicheAbgeleitet(id: number, neu: number | undefined, a: Abgeleitet): void {
  const k = String(id)
  if (k in a.banner && !(k in a.staffel0)) {
    delete a.banner[k]
    a.verworfen.push(`Banner ${k}`)
  }
  if (a.folgen[k] && a.folgen[k]!.tmdbId !== neu) {
    delete a.folgen[k]
    a.verworfen.push(`Folgen ${k}`)
  }
}

/**
 * Setzt die von Hand nachgesehenen Kennungen (`data/tmdb-von-hand.yaml`) in den Bestand; gibt die Zahl der geänderten Einträge zurück.
 * Wechselt die Kennung, entfallen die Genres der alten (der Genre-Nachtrag holt die der neuen); mit `abgeleitet` auch Banner und Folgen der alten.
 */
export function uebernimmVonHand(cache: Record<string, TmdbTitle>, eintraege: VonHandEintrag[], jetzt: string, abgeleitet?: Abgeleitet): number {
  let gesetzt = 0
  for (const e of eintraege) {
    if (!e?.anilistId) continue
    if (e.ohne) {
      if (cache[e.anilistId]) {
        delete cache[e.anilistId]
        gesetzt++
      }
      if (abgeleitet) streicheAbgeleitet(e.anilistId, undefined, abgeleitet)
      continue
    }
    if (!e.tmdbId) continue
    const alt = cache[e.anilistId]
    if (alt?.tmdbId === e.tmdbId) continue
    cache[e.anilistId] = { ...alt, genreIds: undefined, tmdbId: e.tmdbId, kind: e.kind ?? alt?.kind ?? 'tv', fetchedAt: jetzt }
    if (abgeleitet) streicheAbgeleitet(e.anilistId, e.tmdbId, abgeleitet)
    gesetzt++
  }
  return gesetzt
}
