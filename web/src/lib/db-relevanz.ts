import type { Release, ReleaseStatus, Title } from '@shared/types.ts'
import { releaseStatus, titleStatus } from '@shared/logic.ts'

/**
 * Datenbank ohne Suche: Gruppen statt einer langen Liste (Daniel, 09.10.2026, Variante C im Mockup „Datenbank-Einstieg").
 * Maßgeblich ist die **deutsche Erstausgabe** — ein späteres Neuerscheinen bei einem weiteren Anbieter macht einen
 * Titel nicht wieder zu einem laufenden (Rooster Fighter gehört unter „Schon erschienen").
 */
export type RelevanzArt = 'laeuft' | 'bald' | 'erschienen'

export interface Einstufung {
  art: RelevanzArt
  /** Startdatum der ersten deutschen Fassung, wo bekannt. */
  ab?: string
}

export const RELEVANZ_REIHENFOLGE: readonly RelevanzArt[] = ['laeuft', 'bald', 'erschienen']

const fruehesterTermin = (releases: Release[]): Release | undefined =>
  releases
    .filter((r) => r.schedule?.firstEpisodeDate)
    .sort((a, b) => a.schedule!.firstEpisodeDate.localeCompare(b.schedule!.firstEpisodeDate))[0]

/** Ein einzelner Titel: aus `deErstausgabe`; ohne sie gilt der Status aus `titleStatus()`. */
export function stufeTitelEin(t: Title, releases: Release[], today: string): Einstufung {
  const e = t.deErstausgabe
  if (!e) {
    const status = titleStatus(releases, today, t)
    const termine = (s: string) => releases.filter((r) => releaseStatus(r, today) === s).map((r) => r.schedule?.firstEpisodeDate ?? '').sort()
    if (status === 'airing') return { art: 'laeuft', ab: termine('airing').pop() || undefined }
    if (status === 'tba') return { art: 'bald', ab: termine('tba').find(Boolean) }
    return { art: 'erschienen' }
  }
  if (e.von && e.von > today) return { art: 'bald', ab: e.von }
  if (e.bis) return e.bis >= today ? { art: 'laeuft', ab: e.von } : { art: 'erschienen' }
  // Ohne Ende gilt der früheste Termin als erste Fassung; läuft nur ein späterer, ist die Erstausgabe vorbei.
  const erste = fruehesterTermin(releases)
  return erste && releaseStatus(erste, today) === 'airing' ? { art: 'laeuft', ab: erste.schedule!.firstEpisodeDate } : { art: 'erschienen' }
}

/** Eine Reihe: läuft, sobald ein Teil läuft; sonst demnächst, sobald einer bald beginnt. */
export function stufeReiheEin(members: Title[], releasesByTitle: Map<number, Release[]>, today: string): Einstufung {
  let laeuft: string | undefined
  let hatLaeuft = false
  let bald: string | undefined
  let hatBald = false
  for (const m of members) {
    const s = stufeTitelEin(m, releasesByTitle.get(m.id) ?? [], today)
    if (s.art === 'laeuft') {
      hatLaeuft = true
      if (s.ab && (!laeuft || s.ab > laeuft)) laeuft = s.ab
    } else if (s.art === 'bald') {
      hatBald = true
      if (s.ab && (!bald || s.ab < bald)) bald = s.ab
    }
  }
  if (hatLaeuft) return { art: 'laeuft', ab: laeuft }
  if (hatBald) return { art: 'bald', ab: bald }
  return { art: 'erschienen' }
}

export interface RelevanzEintrag<T> {
  gruppe: T
  ab?: string
}

export interface RelevanzGruppe<T> {
  art: RelevanzArt
  eintraege: RelevanzEintrag<T>[]
}

/** Innerhalb der Gruppe: Anime vor Cartoons; laufend jüngster Start zuerst, demnächst nächster Start zuerst, erschienen jüngstes Jahr, dann Bewertung. Stabil. */
function vergleicher<T extends { main: Title }>(art: RelevanzArt) {
  return (a: RelevanzEintrag<T>, b: RelevanzEintrag<T>): number => {
    const cartoon = Number(!!a.gruppe.main.westlich) - Number(!!b.gruppe.main.westlich)
    if (cartoon) return cartoon
    if (art === 'laeuft') return (b.ab ?? '').localeCompare(a.ab ?? '')
    if (art === 'bald') return (a.ab ?? '9999').localeCompare(b.ab ?? '9999')
    return (b.gruppe.main.jpYear ?? 0) - (a.gruppe.main.jpYear ?? 0) || (b.gruppe.main.score ?? 0) - (a.gruppe.main.score ?? 0)
  }
}

/** Teilt Kacheln in „Läuft jetzt", „Demnächst" und „Schon erschienen"; leere Gruppen fallen weg. */
export function gruppiereNachRelevanz<T extends { main: Title; members: Title[] }>(
  gruppen: T[],
  releasesByTitle: Map<number, Release[]>,
  today: string,
): RelevanzGruppe<T>[] {
  const korb: Record<RelevanzArt, RelevanzEintrag<T>[]> = { laeuft: [], bald: [], erschienen: [] }
  for (const gruppe of gruppen) {
    const s = stufeReiheEin(gruppe.members, releasesByTitle, today)
    korb[s.art].push({ gruppe, ab: s.ab })
  }
  return RELEVANZ_REIHENFOLGE.map((art) => ({ art, eintraege: korb[art].sort(vergleicher<T>(art)) })).filter((g) => g.eintraege.length > 0)
}

/** Sagt die Gruppenüberschrift den Status der Kachel schon? Dann bleibt die Pille weg („keine Information zweimal"). */
export function ueberschriftSagtStatus(art: RelevanzArt, status: ReleaseStatus): boolean {
  if (art === 'laeuft') return status === 'airing'
  if (art === 'bald') return status === 'tba'
  return status === 'abgeschlossen' || status === 'erschienen'
}

/** Gruppen gibt es nur in der Vorgabe „Relevanz" ohne Suche; mit Suche entscheidet die Treffergüte. */
export const istGruppiert = (sort: string, suche: string): boolean => sort === 'relevanz' && !suche.trim()
