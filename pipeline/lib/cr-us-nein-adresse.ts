import type { CrDubData } from './crunchyroll-dub.ts'

/**
 * Ein „nicht mehr verfügbar“ aus dem US-Katalog trifft nur die US-Adresse (Auftrag 24.10.2026).
 *
 * Führt der deutsche Katalog dieselbe Serienkennung mit Staffeln und meldet keine deutsche Zeile
 * sie als tot, bleibt jeder Weg auf eine deutsche Adresse (`/de/…`) stehen: Das US-Nein sagt nichts
 * über Deutschland. Gemessen am 24.10.2026: My Teen Romantic Comedy SNAFU: Climax verlor so den Weg,
 * obwohl der deutsche Katalog die Serie mit drei Staffeln führt.
 */

/** Kennungen, die der deutsche Katalog mit Staffeln führt und keine deutsche Zeile verneint. */
export function deutschFuehrtSerie(crDub: CrDubData): Set<string> {
  const ja = new Set<string>()
  const nein = new Set<string>()
  for (const s of crDub.serien) {
    if (s.katalog !== 'de' || !s.seriesId) continue
    if (s.nichtVerfuegbar || !(s.staffeln ?? []).length) nein.add(s.seriesId)
    else ja.add(s.seriesId)
  }
  return new Set([...ja].filter((id) => !nein.has(id)))
}

/** Zeigt der Weg auf die deutsche Fassung der Seite (Pfad beginnt mit `/de/`)? */
export function istDeutscheAdresse(url: string): boolean {
  return /^https?:\/\/(www\.)?crunchyroll\.com\/de\//.test(url)
}
