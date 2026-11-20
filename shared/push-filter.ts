/**
 * **Welche Termine der Kalender zeigt, soweit der Termin allein es entscheidet** (20.11.2026) — dieselbe Regel für die
 * Oberfläche (`web/src/lib/filters.ts`) und für den Push im Worker, der den Datensatz nicht hat (Daniel: „TV ausgeblendet,
 * Benachrichtigung zu einer TV-Folge“). Der Browser schickt die Teilmenge des Filters, die diese Regel braucht, mit dem
 * Abo (`schreibeTerminFilter`); der Worker liest sie (`leseTerminFilter`) und wendet `passtAmTermin` an.
 *
 * Nicht dabei, weil der Termin allein es nicht beantwortet: Genre, Schlagwort, FSK, Herkunft, Wertung, kostenlos, Jahr, Status,
 * „bestätigt“ (`Release.schedule.estimated` gilt je Release, `ReleaseEvent.estimated` je Termin).
 */
export interface TerminFilter {
  /** Fernseh-Termine ausblenden; Premieren bleiben sichtbar (`tvSichtbar`). */
  tvAus?: boolean
  platforms: readonly string[]
  releaseTypes: readonly string[]
  excluded: { platforms: readonly string[]; releaseTypes: readonly string[] }
  zweitanbieterExcluded: boolean
}

/** Plattform und Art gegen Einschluss und Ausschluss; Ausschluss schlägt Einschluss. */
export function passtAmTermin(platform: string, releaseType: string, f: Pick<TerminFilter, 'platforms' | 'releaseTypes' | 'excluded'>): boolean {
  if (f.excluded.platforms.includes(platform) || f.excluded.releaseTypes.includes(releaseType)) return false
  if (f.platforms.length && !f.platforms.includes(platform)) return false
  if (f.releaseTypes.length && !f.releaseTypes.includes(releaseType)) return false
  return true
}

/** Ausgeblendetes Fernsehen lässt Premieren stehen; `premiere` rechnet der Aufrufer (Seite: `tvPremiere`, Worker: das Bau-Flag). */
export const tvSichtbar = (platform: string, premiere: boolean, tvAus: boolean | undefined): boolean => !tvAus || platform !== 'tv' || premiere

/** Was der Termin hergeben muss; der Worker-Termin (`ReleaseEvent`) trägt alles. */
export interface FilterTermin {
  platform: string
  releaseType: string
  tvPremiere?: boolean
  zweitanbieter?: unknown
}

/** Die ganze Regel für einen Termin (Worker); die Seite ruft die Teile an ihren Stellen auf. */
export function terminSichtbar(e: FilterTermin, f: TerminFilter | null): boolean {
  if (!f) return true
  return passtAmTermin(e.platform, e.releaseType, f) && !(f.zweitanbieterExcluded && e.zweitanbieter) && tvSichtbar(e.platform, e.tvPremiere === true, f.tvAus)
}

/** Obergrenzen für Eingaben aus dem Browser: Einträge je Liste, Zeichen je Eintrag. */
const MAX_EINTRAEGE = 20
const NAME = /^[a-z0-9_-]{1,30}$/

function liste(wert: unknown): string[] | null {
  if (wert === undefined) return []
  if (!Array.isArray(wert) || wert.length > MAX_EINTRAEGE) return null
  return wert.every((v) => typeof v === 'string' && NAME.test(v)) ? (wert as string[]) : null
}

/** Der Wert, der ans Abo geht: nur Gesetztes; `null`, wenn nichts gefiltert wird. */
export function schreibeTerminFilter(f: TerminFilter): Record<string, unknown> | null {
  const raus: Record<string, unknown> = {
    ...(f.tvAus && { tvAus: true }),
    ...(f.platforms.length && { platforms: f.platforms }),
    ...(f.releaseTypes.length && { releaseTypes: f.releaseTypes }),
    ...(f.excluded.platforms.length && { xPlatforms: f.excluded.platforms }),
    ...(f.excluded.releaseTypes.length && { xReleaseTypes: f.excluded.releaseTypes }),
    ...(f.zweitanbieterExcluded && { zweitanbieterExcluded: true }),
  }
  return Object.keys(raus).length ? raus : null
}

/** Liest den Wert aus dem Browser; jede Abweichung (Typ, Länge, Zeichen) heißt „kein Filter“ — nie ein halber. */
export function leseTerminFilter(roh: unknown): TerminFilter | null {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return null
  const r = roh as Record<string, unknown>
  const [platforms, releaseTypes, xPlatforms, xReleaseTypes] = [r.platforms, r.releaseTypes, r.xPlatforms, r.xReleaseTypes].map(liste)
  if (!platforms || !releaseTypes || !xPlatforms || !xReleaseTypes) return null
  const f: TerminFilter = {
    ...(r.tvAus === true && { tvAus: true }),
    platforms,
    releaseTypes,
    excluded: { platforms: xPlatforms, releaseTypes: xReleaseTypes },
    zweitanbieterExcluded: r.zweitanbieterExcluded === true,
  }
  return schreibeTerminFilter(f) ? f : null
}
