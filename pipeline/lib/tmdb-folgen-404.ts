import { diffDays } from '../../shared/time.ts'

/** Negativvermerk in `data/tmdb-folgen-404.json`: TMDB kennt die Serie unter dieser Kennung nicht (404). Keine Folgendaten, darum eigene Datei. */
export interface Vermerk404 {
  tmdbId: number
  /** Tag der Antwort 404, `YYYY-MM-DD`. */
  geprueft: string
}

/** Der Vermerk hält den Titel zurück, solange er die gleiche TMDB-Kennung betrifft und jünger als die Altersgrenze ist; am Tag der Grenze ist der Titel wieder dran. */
export function vermerkGilt(v: Vermerk404 | undefined, tmdbId: number | undefined, heute: string, alterTage: number): boolean {
  if (!v || v.tmdbId !== tmdbId) return false
  return diffDays(v.geprueft, heute) < alterTage
}

/** Ob der Titel neu gesucht werden muss: sein Eintrag trägt die Kennung, auf die TMDB mit 404 antwortete, und wurde seither nicht neu gesucht. */
export function neusucheFaellig(v: Vermerk404 | undefined, eintrag: { tmdbId?: number; fetchedAt?: string } | undefined): boolean {
  if (!v || !eintrag || v.tmdbId !== eintrag.tmdbId) return false
  return (eintrag.fetchedAt ?? '').slice(0, 10) <= v.geprueft
}

/** Nur die Antwort 404 auf den Serien-Abruf ist eine Auskunft; 5xx, Netzfehler und 404 auf Staffeln sind es nicht. */
export function istSerie404(err: unknown, tmdbId: number): boolean {
  return new RegExp(`^404 [^:]*: \\S*/tv/${tmdbId}\\?`).test((err as Error).message ?? '')
}
