import type { CrDubData } from './crunchyroll-dub.ts'

/**
 * Ein „nicht mehr verfügbar“ aus dem US-Katalog trifft nur die US-Adresse (Auftrag 24.10.2026).
 *
 * Führt der deutsche Katalog dieselbe Serienkennung mit Staffeln, bleibt jeder Weg auf eine deutsche
 * Adresse (`/de/…`) stehen: Das US-Nein sagt nichts über Deutschland. Meldet ein deutscher Satz die
 * Serie als tot (nicht verfügbar oder ohne Staffel), entfernt ihn die Bau-Phase selbst, auch ohne diesen Schutz.
 * Gemessen am 24.10.2026: My Teen Romantic Comedy SNAFU: Climax verlor den Weg, obwohl der deutsche
 * Katalog die Serie mit drei Staffeln führt.
 */

/** Kennungen, die der deutsche Katalog mit mindestens einer Staffel führt. */
export function deutschFuehrtSerie(crDub: CrDubData): Set<string> {
  const ids = crDub.serien
    .filter((s) => s.katalog === 'de' && s.seriesId && (s.staffeln ?? []).length > 0)
    .map((s) => s.seriesId as string)
  return new Set(ids)
}

/** Zeigt der Weg auf die deutsche Fassung der Seite (Pfad beginnt mit `/de/`)? */
export function istDeutscheAdresse(url: string): boolean {
  return /^https?:\/\/(www\.)?crunchyroll\.com\/de\//.test(url)
}
