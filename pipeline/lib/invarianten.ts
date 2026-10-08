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

/** Alle Invarianten über Releases und Termine. */
export function pruefeInvarianten(releases: Release[], events: ReleaseEvent[], titles: Map<number, Title>): Invarianten {
  const verweise = verweiseAufgeloest(releases, events, titles)
  return {
    fehler: [...slugsEindeutig(releases), ...folgennummernEindeutig(releases, events), ...verweise.fehler],
    warnungen: verweise.warnungen,
  }
}

/** Zählworte der Oberfläche (Fußzeile, Ladehinweis) gegen die Länge der ausgelieferten Dateien (B-07, B-08). */
export function zaehlworteStimmen(
  meta: { titleCount: number; releaseCount: number; eventCount: number },
  datei: { titles: number; releases: number; events: number },
): string[] {
  const paare: [string, number, number][] = [
    ['titleCount', meta.titleCount, datei.titles],
    ['releaseCount', meta.releaseCount, datei.releases],
    ['eventCount', meta.eventCount, datei.events],
  ]
  return paare.filter(([, soll, ist]) => soll !== ist).map(([name, soll, ist]) => `meta.${name} nennt ${soll}, die Datei enthält ${ist}`)
}
