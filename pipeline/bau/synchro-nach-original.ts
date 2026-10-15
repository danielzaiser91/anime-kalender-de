import type { Release } from '../../shared/types.ts'
import { termineNachOriginal } from '../../shared/synchro-original.ts'
import { log } from '../lib/util.ts'
import type { TmdbEintrag } from './folgentitel-tmdb.ts'

/** Originaltage einer Serie je Folgennummer — nur bei genau einer echten TMDB-Staffel (Staffel 0 sind Specials), sonst ist die Nummer nicht eindeutig. */
export function originalTage(eintrag: TmdbEintrag | undefined): Record<number, string> {
  const folgen = (eintrag?.folgen ?? []).filter((f) => f.s >= 1 && f.datum)
  if (new Set(folgen.map((f) => f.s)).size !== 1) return {}
  return Object.fromEntries(folgen.map((f) => [f.e, f.datum!]))
}

/**
 * Schreibt `schedule.nachOriginal` an wöchentliche Releases, deren Synchro dem Original in stabilem Abstand folgt
 * (`shared/synchro-original.ts`). Feste Sendetage (Fernsehen) bleiben außen vor: dort ist der Plan der Anbieter selbst.
 * Gibt die Zahl der Releases zurück, an die etwas geschrieben wurde.
 */
export function schreibeNachOriginal(releases: Release[], tmdb: Record<string, TmdbEintrag>): number {
  let n = 0
  for (const r of releases) {
    const s = r.schedule
    if (r.releaseType !== 'weekly' || !s?.observed || s.wochentage?.length) continue
    const bis = Math.max(1, s.firstEpisodeNumber ?? 1) + (s.episodeCount ?? 1) - 1
    const nachOriginal = termineNachOriginal(s.observed, originalTage(tmdb[String(r.titleId)]), bis)
    if (!Object.keys(nachOriginal).length) continue
    s.nachOriginal = nachOriginal
    n++
  }
  log(`Synchro nach Originalterminen fortgeschrieben: ${n} Releases`)
  return n
}
