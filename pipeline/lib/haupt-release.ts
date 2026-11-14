import type { Release } from '../../shared/types.ts'
import { expandEvents } from '../../shared/logic.ts'

/**
 * Rang eines Releases als Hauptrelease einer Titelseite (Daniel, 13.11.2026): Stream (Abo/Simulcast) vor TV-Ausstrahlung
 * (Kino zählt als Premiere dazu) vor Disc. Kleinere Zahl = wichtiger. Leih-/Kauf-Stream ist in den Releases nicht eigens
 * gekennzeichnet und fällt hier unter Stream.
 */
export function hauptRang(r: Pick<Release, 'platform' | 'releaseType'>): number {
  if (r.platform === 'disc' || r.releaseType === 'disc') return 2
  if (r.platform === 'tv' || r.platform === 'kino') return 1
  return 0
}

function naechsterTag(r: Release, today: string): string | undefined {
  return expandEvents(r).find((e) => e.date >= today)?.date
}

/**
 * Hauptrelease einer Titelseite: unter den Releases mit künftigem Termin der höchste Rang, bei Gleichstand der früheste nächste Termin.
 * Ohne künftigen Termin: das letzte nach erstem Datum (wie bisher).
 */
export function hauptRelease(rs: Release[], today: string): Release | undefined {
  const kuenftig = rs.flatMap((r) => {
    const datum = naechsterTag(r, today)
    return datum ? [{ r, datum }] : []
  })
  if (kuenftig.length) {
    kuenftig.sort((a, b) => hauptRang(a.r) - hauptRang(b.r) || a.datum.localeCompare(b.datum))
    return kuenftig[0]!.r
  }
  return [...rs].sort((a, b) => a.schedule.firstEpisodeDate.localeCompare(b.schedule.firstEpisodeDate)).at(-1)
}
