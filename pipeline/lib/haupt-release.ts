/**
 * Welches Release eine Titelseite trägt (13.11.2026): Vorschaubild, og:title und Kopf kommen von diesem einen.
 * Rang nach Daniel: Stream-Abo/Simulcast > TV-Ausstrahlung > Kino > Disc. Leih-/Kauf-Stream ist im Datensatz keine
 * eigene Art (kein Feld dafür), fällt also in „Stream“. Unter gleichem Rang gewinnt der früheste kommende Termin.
 */
import type { Release } from '../../shared/types.ts'
import { expandEvents, releaseStatus } from '../../shared/logic.ts'

export function releaseRang(r: Pick<Release, 'platform'>): number {
  if (r.platform === 'tv') return 1
  if (r.platform === 'kino') return 2
  if (r.platform === 'disc') return 3
  return 0
}

/** Der nächste Termin eines Titels nach Datum, sonst der letzte (Rückfall ohne künftigen Termin). */
export function naechsterTermin(rs: Release[], today: string): Release | undefined {
  const nachDatum = [...rs].sort((a, b) => a.schedule.firstEpisodeDate.localeCompare(b.schedule.firstEpisodeDate))
  return nachDatum.find((r) => r.schedule.firstEpisodeDate >= today) ?? nachDatum[nachDatum.length - 1]
}

function naechstesEreignis(r: Release, today: string): string | undefined {
  if (releaseStatus(r, today) === 'unbekannt') return undefined
  return expandEvents(r).find((e) => e.date >= today)?.date
}

export function hauptRelease(rs: Release[], today: string): Release | undefined {
  const kandidaten = rs.flatMap((r) => {
    const datum = naechstesEreignis(r, today)
    return datum ? [{ r, datum }] : []
  })
  if (!kandidaten.length) return naechsterTermin(rs, today)
  kandidaten.sort((a, b) => releaseRang(a.r) - releaseRang(b.r) || a.datum.localeCompare(b.datum))
  return kandidaten[0].r
}
