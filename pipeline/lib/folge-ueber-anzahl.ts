/**
 * **Eine beobachtete Folge über der Folgenzahl ist ein Termin, kein Überschuss** (16.10.2026,
 * „Though I Am an Inept Villainess": Folge 12 am 18.10. 17:45 im Wochenprogramm von Crunchyroll,
 * `episodeCount` 11 aus dem AniList-Cache vom 03.09.).
 *
 * `termineAusPlan()` erzeugt höchstens `episodeCount` Termine; die zwölfte Folge verschwand ohne
 * Warnung, und Folge 11 trug die Marke `staffelfinale`, gedeckt nur durch die AniList-Zahl. Eine Quelle,
 * die eine Folge ankündigt, widerlegt die Zahl — gestrichen wird aber nur, was eine Quelle widerlegt, und
 * die Folgenzahl ist damit nicht belegt, sondern unsicher: Sie wird auf die höchste Beobachtung angehoben
 * und als angenommen gekennzeichnet (`episodeCountAssumed`, in der Oberfläche „≈", ohne Finale-Marke).
 */
import type { Release, ReleaseEvent } from '../../shared/types.ts'
import { warn } from './util.ts'

/** Höchste beobachtete Folgennummer eines wöchentlichen Releases mit Datum, sonst `undefined`. */
function hoechsteBeobachtung(r: Release): number | undefined {
  if (r.releaseType !== 'weekly') return undefined
  const nummern = Object.entries(r.schedule.observed ?? {})
    .filter(([, datum]) => datum)
    .map(([nr]) => Number(nr))
  return nummern.length ? Math.max(...nummern) : undefined
}

/** Letzte Folgennummer, bis zu der `termineAusPlan()` Termine erzeugt (ohne Zahl: eine Folge). */
function letzteNummer(r: Release): number {
  return Math.max(1, r.schedule.firstEpisodeNumber ?? 1) + (r.schedule.episodeCount ?? 1) - 1
}

/** Belegtes Ende: `lastEpisodeDate` liegt vor dem Tag der höchsten Beobachtung — eine Quelle widerspricht der anderen. */
function endeWiderlegtBeobachtung(r: Release, hoechste: number): boolean {
  const ende = r.schedule.lastEpisodeDate
  const tag = r.schedule.observed?.[hoechste]
  return ende !== undefined && !!tag && tag > ende
}

/**
 * Hebt die Folgenzahl auf die höchste Beobachtung an, wo diese darüber liegt, und kennzeichnet sie als
 * angenommen. Verändert die Releases; gibt die betroffenen Slugs zurück. Bei belegtem Ende
 * (`lastEpisodeDate`) bleibt die Zahl: Das Ende schlägt die Fortschreibung, den Widerspruch meldet
 * `beobachtetOhneTermin` als Fehler.
 */
export function hebeFolgenzahlAufBeobachtung(releases: Release[]): string[] {
  const betroffen: string[] = []
  for (const r of releases) {
    const hoechste = hoechsteBeobachtung(r)
    if (hoechste === undefined || hoechste <= letzteNummer(r)) continue
    if (endeWiderlegtBeobachtung(r, hoechste)) {
      warn(`"${r.slug}": Folge ${hoechste} nach dem belegten Ende (${r.schedule.lastEpisodeDate}) beobachtet — Folgenzahl bleibt ${r.schedule.episodeCount ?? 'offen'}, bitte prüfen`)
      continue
    }
    const alt = r.schedule.episodeCount
    r.schedule.episodeCount = hoechste - Math.max(1, r.schedule.firstEpisodeNumber ?? 1) + 1
    r.schedule.episodeCountAssumed = true
    delete r.schedule.episodeCountSource
    warn(`"${r.slug}": Folge ${hoechste} beobachtet, Folgenzahl war ${alt ?? 'offen'} — auf ${r.schedule.episodeCount} angehoben, als angenommen gekennzeichnet`)
    betroffen.push(r.slug)
  }
  return betroffen
}

/**
 * Fehler für jede datierte Beobachtung ab `firstEpisodeNumber`, zu der kein Termin im Datensatz steht — gleich, ob
 * die Folge über oder (z. B. durch den Filter `lastEpisodeDate`) innerhalb der Folgenzahl liegt: Eine Quelle nennt
 * die Folge, der Datensatz verliert sie still. Im Bestand vom 16.10.2026 trifft das nur Villainess F12 (breit = eng = 1).
 */
export function beobachtetOhneTermin(releases: Release[], events: ReleaseEvent[]): string[] {
  const vorhanden = new Set(events.map((e) => `${e.releaseSlug}#${e.episode}`))
  const fehler: string[] = []
  for (const r of releases) {
    if (r.widerlegt || hoechsteBeobachtung(r) === undefined) continue
    for (const [nr, datum] of Object.entries(r.schedule.observed ?? {})) {
      if (!datum || Number(nr) < (r.schedule.firstEpisodeNumber ?? 1) || vorhanden.has(`${r.slug}#${nr}`)) continue
      fehler.push(`"${r.slug}": Folge ${nr} am ${datum} beobachtet (Folgenzahl ${r.schedule.episodeCount ?? 'offen'}), aber ohne Termin im Datensatz`)
    }
  }
  return fehler
}
