import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import type { TmdbTitle } from '../fetch-tmdb-titles.ts'
import { ROOT } from './util.ts'

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
  /** Plakat und Abruf-Grund je AniList-ID (`data/tmdb-poster*.json`); bei `ohne` entfallen beide sofort, sonst bliebe ein verworfenes Bild bis zum Ablauf live. Die Plakatsuchen nehmen diese Titel über `ohneKennungen` aus, sonst fände sie der Namensabgleich neu. */
  poster: Record<string, unknown>
  posterGrund: Record<string, unknown>
  verworfen: string[]
}

/**
 * Streicht Banner (hängt ohne Kennung am Titel) und Folgen einer anderen Kennung als `neu`; `neu` leer = Kennung entfällt.
 * Grenzen (Bestand 11.11.2026): Bekommt ein Staffel-0-Titel eine neue Kennung, bleibt sein Standbild (0 Fälle); ein Folgen-Eintrag ohne `tmdbId` entfällt bei `ohne` nicht (930 von 930 haben das Feld).
 */
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

/** AniList-Kennungen mit `ohne: true` in `data/tmdb-von-hand.yaml`: kein Plakat-Namensabgleich darf sie bedienen, sonst käme das Plakat des Originals zurück. */
export function ohneKennungen(): Set<number> {
  const datei = resolve(ROOT, 'data/tmdb-von-hand.yaml')
  const zeilen = existsSync(datei) ? ((yaml.load(readFileSync(datei, 'utf8')) as VonHandEintrag[] | null) ?? []) : []
  return new Set(zeilen.filter((e) => e?.ohne && e.anilistId).map((e) => e.anilistId))
}

/** `ohne`: Plakat und Plakatgrund der Kennungslosen streichen und benennen. */
function streichePoster(id: number, a: Abgeleitet): void {
  const k = String(id)
  if (k in a.poster) {
    delete a.poster[k]
    a.verworfen.push(`Plakat ${k}`)
  }
  if (k in a.posterGrund) {
    delete a.posterGrund[k]
    a.verworfen.push(`Plakatgrund ${k}`)
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
      if (abgeleitet) {
        streicheAbgeleitet(e.anilistId, undefined, abgeleitet)
        streichePoster(e.anilistId, abgeleitet)
      }
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
