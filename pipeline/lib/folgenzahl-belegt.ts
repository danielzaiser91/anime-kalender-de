/**
 * **„≈" nur, wenn die Gesamtzahl wirklich nur angenommen ist** (Daniel, 13.10.2026, „Das Band
 * der Unterwelt": Netflix „Folge 16/≈24", obwohl Crunchyroll das Finale (Folge 24) am 10.10. zeigte).
 *
 * Ein Release trägt `episodeCountAssumed`, wenn sein Anbieter keine Gesamtzahl nennt. Belegt ein
 * anderer Release derselben Titel-ID die Zahl, fällt die Annahme weg — aber nur, wenn die Folgen
 * des Releases genau bis dorthin reichen. Läuft sie woanders hin, bleibt das „≈" und die
 * Abweichung wird gemeldet. `titles.episodes` allein ist kein Beleg.
 */
import type { Release } from '../../shared/types.ts'
import { log, warn } from './util.ts'

/** Ergebnis je Titel-ID: aufgehoben oder abweichend (dann bleibt das „≈"). */
export interface FolgenzahlUrteil {
  slug: string
  belegtN: number
  quelleSlug: string
  aufgehoben: boolean
}

/**
 * Die Gesamtzahl N, die dieser Release selbst belegt — sonst `undefined`.
 * Belegt heißt: Folgen lückenlos ab 1 beobachtet, und entweder trägt `lastEpisodeDate` den Tag der
 * letzten beobachteten Folge N, oder die nicht angenommene `episodeCount` ist genau N.
 */
export function belegteGesamtzahl(r: Release): number | undefined {
  const s = r.schedule
  if (!s || s.episodeCountAssumed || (s.firstEpisodeNumber ?? 1) !== 1) return undefined
  const nummern = Object.keys(s.observed ?? {})
    .map(Number)
    .sort((a, b) => a - b)
  const n = nummern.length
  if (!n || nummern.some((nr, i) => nr !== i + 1)) return undefined
  const endetBeiN = s.lastEpisodeDate !== undefined && s.observed![n] === s.lastEpisodeDate
  return s.episodeCount === n && (endetBeiN || s.lastEpisodeDate === undefined) ? n : undefined
}

/** Letzte Folgennummer, die der Release laut `firstEpisodeNumber` und `episodeCount` abdeckt. */
function letzteNummer(r: Release): number | undefined {
  return r.schedule.episodeCount ? (r.schedule.firstEpisodeNumber ?? 1) + r.schedule.episodeCount - 1 : undefined
}

/**
 * Hebt `episodeCountAssumed` (und die Herkunft `episodeCountSource`) auf, wo ein anderer Release
 * derselben Titel-ID die Gesamtzahl belegt und die Folgenzahl dazu passt. Verändert die Releases.
 */
export function hebeAnnahmeAuf(releases: Release[]): FolgenzahlUrteil[] {
  const belegt = new Map<number, { n: number; slug: string }[]>()
  for (const r of releases) {
    const n = belegteGesamtzahl(r)
    if (n === undefined) continue
    belegt.set(r.titleId, [...(belegt.get(r.titleId) ?? []), { n, slug: r.slug }])
  }
  const urteile: FolgenzahlUrteil[] = []
  for (const r of releases) {
    if (!r.schedule?.episodeCountAssumed) continue
    const quellen = belegt.get(r.titleId)?.filter((q) => q.slug !== r.slug)
    if (!quellen?.length) continue
    const passend = quellen.find((q) => q.n === letzteNummer(r))
    const quelle = passend ?? quellen[0]!
    if (passend) {
      delete r.schedule.episodeCountAssumed
      delete r.schedule.episodeCountSource
    }
    urteile.push({ slug: r.slug, belegtN: quelle.n, quelleSlug: quelle.slug, aufgehoben: Boolean(passend) })
  }
  return urteile
}

/** Bau-Schritt: hebt auf und meldet im Protokoll, was geändert wurde und wo die Zahlen nicht zusammenpassen. */
export function hebeFolgenzahlAnnahmeAuf(releases: Release[]): void {
  for (const u of hebeAnnahmeAuf(releases)) {
    if (u.aufgehoben) log(`Folgenzahl "${u.slug}": ≈ aufgehoben, ${u.belegtN} Folgen belegt durch "${u.quelleSlug}"`)
    else warn(`Folgenzahl "${u.slug}": "${u.quelleSlug}" belegt ${u.belegtN} Folgen, die Folgen dieses Releases enden anderswo — ≈ bleibt`)
  }
}
