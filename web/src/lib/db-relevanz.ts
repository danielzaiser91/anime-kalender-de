import type { Release, ReleaseStatus, Title } from '@shared/types.ts'
import { releaseStatus, titleStatus } from '@shared/logic.ts'
import { addDays } from '@shared/time.ts'

/**
 * Datenbank ohne Suche: Gruppen statt einer langen Liste (Daniel, 09.10.2026, Variante C im Mockup „Datenbank-Einstieg").
 * Maßgeblich ist die **deutsche Erstausgabe** — ein späteres Neuerscheinen bei einem weiteren Anbieter macht einen
 * Titel nicht wieder zu einem laufenden (Rooster Fighter gehört unter „Schon erschienen").
 */
export type RelevanzArt = 'laeuft' | 'bald' | 'erschienen' | 'unbekannt'

export interface Einstufung {
  art: RelevanzArt
  /** Startdatum der ersten deutschen Fassung, wo bekannt. */
  ab?: string
}

export const RELEVANZ_REIHENFOLGE: readonly RelevanzArt[] = ['laeuft', 'bald', 'erschienen', 'unbekannt']

/** aniSearch nennt bei Simuldubs den Simulcast-Start: ein paar Wochen Abstand zum eigenen Termin sind kein früheres Erscheinen. */
const TOLERANZ_TAGE = 60

const istDisc = (r: Release): boolean => r.releaseType === 'disc'
/** Eine Einzelsendung im Fernsehen (ein Film läuft einmal) ist keine laufende Erstausgabe. */
const istEinzelTv = (r: Release): boolean => r.platform === 'tv' && (r.schedule?.episodeCount ?? 2) <= 1
const startVon = (r: Release): string => r.schedule?.firstEpisodeDate ?? ''

/** Der früheste Termin mit gültigem Status (widerlegte fallen weg). */
const fruehesterTermin = (releases: Release[], today: string): Release | undefined =>
  releases
    .filter((r) => startVon(r) && releaseStatus(r, today) !== 'unbekannt')
    .sort((a, b) => startVon(a).localeCompare(startVon(b)))[0]

/** Mit Erstausgabe von aniSearch: sie sagt, wann die deutsche Fassung begann; die Termine zeigen, ob dieser Lauf noch geht. */
function stufeMitErstausgabe(e: NonNullable<Title['deErstausgabe']>, nichtDisc: Release[], today: string): Einstufung {
  if (e.von && e.von > today) return { art: 'bald', ab: e.von }
  if (e.bis) return e.bis >= today ? { art: 'laeuft', ab: e.von } : { art: 'erschienen' }
  const erste = fruehesterTermin(nichtDisc, today)
  // Begann die deutsche Fassung längst vor dem frühesten Termin, ist die Erstausgabe vorbei (Yashahime: seit 2023, TV ab 07.10.2026).
  const vorbei = e.von ? !erste || addDays(e.von, TOLERANZ_TAGE) < startVon(erste) : false
  return !vorbei && erste && releaseStatus(erste, today) === 'airing' && !istEinzelTv(erste) ? { art: 'laeuft', ab: startVon(erste) } : { art: 'erschienen' }
}

/** Ohne Erstausgabe: der früheste Nicht-Disc-Termin ist die erste Fassung; nur Disc-Termine in der Zukunft sind dann die erste Fassung. */
function stufeOhneErstausgabe(t: Title, alle: Release[], nichtDisc: Release[], today: string): Einstufung {
  const hinweisAufSynchro = (t.streams ?? []).some((s) => s.dub === true)
  const erste = fruehesterTermin(nichtDisc, today)
  if (erste) {
    const status = releaseStatus(erste, today)
    if (status === 'airing') return istEinzelTv(erste) ? { art: 'erschienen' } : { art: 'laeuft', ab: startVon(erste) }
    if (status === 'tba' && !hinweisAufSynchro) return { art: 'bald', ab: startVon(erste) }
    return { art: 'erschienen' }
  }
  const disc = alle.filter((r) => istDisc(r) && releaseStatus(r, today) === 'tba').map(startVon).sort()
  if (disc.length && !hinweisAufSynchro) return { art: 'bald', ab: disc[0] }
  return { art: titleStatus(alle, today, t) === 'unbekannt' ? 'unbekannt' : 'erschienen' }
}

/** Ein einzelner Titel. Disc-Termine bestimmen weder „Läuft jetzt" noch (außer als einzige) „Demnächst". */
export function stufeTitelEin(t: Title, alle: Release[], today: string): Einstufung {
  const nichtDisc = alle.filter((r) => !istDisc(r))
  return t.deErstausgabe ? stufeMitErstausgabe(t.deErstausgabe, nichtDisc, today) : stufeOhneErstausgabe(t, alle, nichtDisc, today)
}

/** Eine Reihe: läuft, sobald ein Teil läuft; sonst demnächst, sobald einer bald beginnt; „ohne Termin" nur, wenn kein Teil mehr weiß. */
export function stufeReiheEin(members: Title[], releasesByTitle: Map<number, Release[]>, today: string): Einstufung {
  let laeuft: string | undefined
  let hatLaeuft = false
  let bald: string | undefined
  let hatBald = false
  let hatErschienen = false
  for (const m of members) {
    const s = stufeTitelEin(m, releasesByTitle.get(m.id) ?? [], today)
    if (s.art === 'laeuft') {
      hatLaeuft = true
      if (s.ab && (!laeuft || s.ab > laeuft)) laeuft = s.ab
    } else if (s.art === 'bald') {
      hatBald = true
      if (s.ab && (!bald || s.ab < bald)) bald = s.ab
    } else if (s.art === 'erschienen') hatErschienen = true
  }
  if (hatLaeuft) return { art: 'laeuft', ab: laeuft }
  if (hatBald) return { art: 'bald', ab: bald }
  return { art: hatErschienen ? 'erschienen' : 'unbekannt' }
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
  const korb: Record<RelevanzArt, RelevanzEintrag<T>[]> = { laeuft: [], bald: [], erschienen: [], unbekannt: [] }
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
  if (art === 'unbekannt') return status === 'unbekannt'
  return status === 'abgeschlossen' || status === 'erschienen'
}

/** Gruppen gibt es nur in der Vorgabe „Relevanz" ohne Suche; mit Suche entscheidet die Treffergüte. */
export const istGruppiert = (sort: string, suche: string): boolean => sort === 'relevanz' && !suche.trim()
