/**
 * Invarianten am **fertigen** Ergebnis: Die Wache sieht Verluste, diese Prüfungen sehen falsche Angaben
 * (Autonomie-Fahrplan Schritt 4, Befund B-07). Sie laufen in `schreibeKernUndNews` über die endgültigen
 * Releases und Termine — nach allen späten Ergänzungen — und brechen den Bau bei Widerspruch ab.
 * Gegenprobe je Regel: `pipeline/check-invarianten.ts`.
 */
import type { Release, ReleaseEvent, Title } from '../../shared/types.ts'

export interface Invarianten {
  fehler: string[]
  warnungen: string[]
}

/** Zwei Releases mit derselben Kennung teilen sich Adresse, Ordner und Termine (B-04: auto-112153-tv-toggo-plus). */
export function slugsEindeutig(releases: Release[]): string[] {
  const gesehen = new Set<string>()
  const doppelt = new Set<string>()
  for (const r of releases) (gesehen.has(r.slug) ? doppelt : gesehen).add(r.slug)
  return [...doppelt].map((s) => `"${s}": der Slug kommt mehrfach vor`)
}

/** Eine Folgennummer steht je Release einmal im Kalender (B-03: „Folge 8" dreimal). Discs führen Ausgaben, keine Folgen. */
export function folgennummernEindeutig(releases: Release[], events: ReleaseEvent[]): string[] {
  const ohneFolgen = new Set(releases.filter((r) => r.releaseType === 'disc').map((r) => r.slug))
  const jeRelease = new Map<string, Map<number, number>>()
  for (const e of events) {
    if (e.episode == null || ohneFolgen.has(e.releaseSlug)) continue
    const nummern = jeRelease.get(e.releaseSlug) ?? new Map<number, number>()
    nummern.set(e.episode, (nummern.get(e.episode) ?? 0) + 1)
    jeRelease.set(e.releaseSlug, nummern)
  }
  const fehler: string[] = []
  for (const [slug, nummern] of jeRelease) {
    const doppelt = [...nummern].filter(([, n]) => n > 1).map(([nr, n]) => `${nr}×${n}`)
    if (doppelt.length) fehler.push(`"${slug}": Folgennummer doppelt im Kalender (${doppelt.join(', ')})`)
  }
  return fehler
}

/**
 * Jeder Termin gehört zu einem Release, jedes Release zu einem Titel (B-06: Kalenderkarte ohne Metadaten).
 * `titleId < 0` sind TMDB-Cartoons, die nicht in `titles` stehen; ohne Titel überhaupt (`-1`) ist nur eine Warnung,
 * solange die Event-Show-Einträge noch im Bestand sind.
 */
export function verweiseAufgeloest(releases: Release[], events: ReleaseEvent[], titles: Map<number, Title>): Invarianten {
  const fehler: string[] = []
  const warnungen: string[] = []
  const slugs = new Set(releases.map((r) => r.slug))
  for (const r of releases) {
    if (r.titleId === -1) warnungen.push(`"${r.slug}": Release ohne Titel (titleId -1)`)
    else if (r.titleId >= 0 && !titles.has(r.titleId)) fehler.push(`"${r.slug}": Titel ${r.titleId} gibt es nicht`)
  }
  const waisen = events.filter((e) => !slugs.has(e.releaseSlug))
  if (waisen.length) fehler.push(`${waisen.length} Termin(e) ohne Release, z. B. "${waisen[0].releaseSlug}"`)
  return { fehler, warnungen }
}

/** Releases, deren Anbieter selbst ein nicht steigendes Folgendatum liefert (Quelle belegt, nicht unser Rechenfehler); jeder Eintrag mit Grund und Messdatum. */
export const DATUM_VOM_ANBIETER: Record<string, string> = {
  'lycoris-recoil-crunchyroll-de-2022-07-23': 'Crunchyrolls Katalog datiert Folge 6 auf 2022-08-06T16:00Z, vor Folge 5 (gemessen 08.10.2026, data/crunchyroll-dub.json)',
}

/** D-01: Eine spätere Folge liegt vor einer früheren (Lycoris Recoil). TV-Sichtungen zeigen Wiederholungen in beliebiger Reihenfolge und zählen nicht. */
export function folgenDatumSteigt(releases: Release[], events: ReleaseEvent[]): string[] {
  const ausgenommen = new Set([...releases.filter((r) => r.releaseType === 'disc' || r.tvLetzteSichtung).map((r) => r.slug), ...Object.keys(DATUM_VOM_ANBIETER)])
  const je = new Map<string, ReleaseEvent[]>()
  for (const e of events) if (e.episode != null && !ausgenommen.has(e.releaseSlug)) (je.get(e.releaseSlug) ?? je.set(e.releaseSlug, []).get(e.releaseSlug)!).push(e)
  const fehler: string[] = []
  for (const [slug, liste] of je) {
    const s = liste.sort((a, b) => a.episode! - b.episode! || a.date.localeCompare(b.date))
    const i = s.findIndex((e, k) => k > 0 && e.episode !== s[k - 1].episode && e.date < s[k - 1].date)
    if (i > 0) fehler.push(`"${slug}": Folge ${s[i].episode} (${s[i].date}) liegt vor Folge ${s[i - 1].episode} (${s[i - 1].date})`)
  }
  return fehler
}

/** D-13: Ein Film ist ein Werk — mehrere TV-Sendungen sind Wiederholungen, keine Folgen. Gilt für Film-Format und Release-Typ Film, nicht für Discs. */
export function filmOhneMehrereFolgen(releases: Release[], titles: Map<number, Title>): string[] {
  return releases
    .filter((r) => (r.schedule.episodeCount ?? 0) > 1 && r.releaseType !== 'disc' && (r.releaseType === 'movie' || titles.get(r.titleId)?.format === 'MOVIE'))
    .map((r) => `"${r.slug}": Film mit ${r.schedule.episodeCount} Folgen`)
}

/** D-14: Die deutsche Fassung erscheint nicht vor der japanischen Erstausstrahlung (westliche Serien und Titel ohne Jahr ausgenommen). */
export function deutschNichtVorJapan(releases: Release[], titles: Map<number, Title>): string[] {
  const fehler: string[] = []
  for (const r of releases) {
    const t = titles.get(r.titleId)
    if (t?.jpYear && !t.westlich && r.titleId >= 0 && r.year < t.jpYear) fehler.push(`"${r.slug}": deutsch ${r.schedule.firstEpisodeDate}, Japan erst ${t.jpYear}`)
  }
  return fehler
}

/** D-21: Zwei Termine mit derselben Kennung verschmelzen im Kalender-Abo (ICS-UID). */
export function terminKennungenEindeutig(events: ReleaseEvent[]): string[] {
  const zahl = new Map<string, number>()
  for (const e of events) zahl.set(e.id, (zahl.get(e.id) ?? 0) + 1)
  return [...zahl].filter(([, n]) => n > 1).map(([id, n]) => `Termin-Kennung "${id}" kommt ${n}× vor`)
}

/** D-23: Ein widerlegter Termin steht nicht im Kalender. */
export function widerlegteOhneTermine(releases: Release[], events: ReleaseEvent[]): string[] {
  const widerlegt = new Set(releases.filter((r) => r.widerlegt).map((r) => r.slug))
  const zahl = new Map<string, number>()
  for (const e of events) if (widerlegt.has(e.releaseSlug)) zahl.set(e.releaseSlug, (zahl.get(e.releaseSlug) ?? 0) + 1)
  return [...zahl].map(([slug, n]) => `"${slug}": widerlegt, aber ${n} Termin(e) im Kalender`)
}

/** Alle Invarianten über Releases und Termine. */
export function pruefeInvarianten(releases: Release[], events: ReleaseEvent[], titles: Map<number, Title>): Invarianten {
  const verweise = verweiseAufgeloest(releases, events, titles)
  return {
    fehler: [
      ...slugsEindeutig(releases), ...folgennummernEindeutig(releases, events), ...verweise.fehler,
      ...folgenDatumSteigt(releases, events), ...filmOhneMehrereFolgen(releases, titles), ...deutschNichtVorJapan(releases, titles),
      ...terminKennungenEindeutig(events), ...widerlegteOhneTermine(releases, events),
    ],
    warnungen: verweise.warnungen,
  }
}

/** Zählworte der Oberfläche (Fußzeile, Ladehinweis) gegen die Länge der ausgelieferten Dateien (B-07, B-08). */
export function zaehlworteStimmen(
  meta: { titleCount: number; belegtCount?: number; releaseCount: number; eventCount: number },
  datei: { titles: number; belegt?: number; releases: number; events: number },
): string[] {
  const paare: [string, number, number][] = [
    ['titleCount', meta.titleCount, datei.titles],
    ...(datei.belegt === undefined ? [] : [['belegtCount', meta.belegtCount ?? -1, datei.belegt] as [string, number, number]]),
    ['releaseCount', meta.releaseCount, datei.releases],
    ['eventCount', meta.eventCount, datei.events],
  ]
  return paare.filter(([, soll, ist]) => soll !== ist).map(([name, soll, ist]) => `meta.${name} nennt ${soll}, die Datei enthält ${ist}`)
}
