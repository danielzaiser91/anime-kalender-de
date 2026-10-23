import type { Title, WatchLink } from '@shared/types.ts'
import { seitenKern } from './chips-regeln.ts'

/**
 * **Ein Bezugsweg auf derselben Seite wie ein Verweis des Titels ist keine zweite Pille** (Daniel, 21.10.2026, Saiyuki Reload: Zeroin:
 * „Prime Video (Aniverse)“ und „Amazon Prime (Aniverse)“ führten auf dieselbe Seite). Der Verweis trägt Sprache und Folgen, der Bezugsweg
 * entfällt. Verglichen wird die Seite (`seitenKern`), bei Amazon auch `seite` des Verweises; eine andere Seite (andere Prime-Kennung) bleibt. Nur für Stream-Wege aufgerufen, Kauf-Wege laufen nicht hindurch.
 */
export function bezugswegeOhneVerweisDoppel(title: Pick<Title, 'streams' | 'watchLinks'> | undefined): WatchLink[] {
  const kerne = new Set((title?.streams ?? []).flatMap((s) => [s.url, s.seite]).filter((u): u is string => Boolean(u)).map(seitenKern))
  return (title?.watchLinks ?? []).filter((w) => !kerne.has(seitenKern(w.url)))
}
