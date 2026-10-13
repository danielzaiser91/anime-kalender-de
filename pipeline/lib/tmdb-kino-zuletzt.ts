/**
 * **Wann ein Film zuletzt in einem deutschen Kino lief** — aus TMDB `movie/{id}/release_dates`.
 *
 * Der Kinostart sagt nichts über die Sprachfassung (`fetch-tmdb-kino.ts`, gemessen 25.08.2026); er ist nur ein Zusatz zu einer
 * anderweitig belegten Synchro. Gezählt werden Land DE und Typ 2 (begrenzt) oder 3 (regulär); 4 und 5 sind Stream und Disc,
 * 1 und 6 Premiere und Fernsehen.
 */

export interface ReleaseDatesAntwort {
  results?: Array<{
    iso_3166_1?: string
    release_dates?: Array<{ certification?: string; release_date?: string; type?: number }>
  }>
}

const KINO_TYPEN = [2, 3]

/** Alle deutschen Kinostarts als Tag (`JJJJ-MM-TT`), aufsteigend und ohne Doppelte. */
export function kinostartsDe(antwort: ReleaseDatesAntwort): string[] {
  const de = antwort.results?.find((r) => r.iso_3166_1 === 'DE')
  const tage = (de?.release_dates ?? [])
    .filter((d) => KINO_TYPEN.includes(d.type ?? 0))
    .map((d) => (d.release_date ?? '').slice(0, 10))
    .filter((tag) => /^\d{4}-\d{2}-\d{2}$/.test(tag))
  return [...new Set(tage)].sort()
}

/** Der jüngste Kinostart bis einschließlich `heute`, nur als Monat (`JJJJ-MM`) — den Tag nennen wir nicht. */
export function zuletztImKino(kinoDe: string[] | undefined, heute: string): string | undefined {
  const vergangen = (kinoDe ?? []).filter((tag) => tag <= heute)
  return vergangen.at(-1)?.slice(0, 7)
}

/** Ein Film, dessen Kinostarts noch nie geholt wurden (Eintrag aus der Zeit vor dem Feld `kinoDe`): fällig, auch vor der 60-Tage-Frist. */
export function kinoFehlt(e: { tmdbId?: number; kind?: string; kinoDe?: string[] }): boolean {
  return e.kind === 'movie' && Boolean(e.tmdbId) && e.kinoDe === undefined
}
