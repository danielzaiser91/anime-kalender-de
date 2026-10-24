import type { CrDubData } from './crunchyroll-dub.ts'

/**
 * Ein „nicht mehr verfügbar“ aus dem US-Katalog trifft nur die US-Adresse (Auftrag 24.10.2026).
 *
 * Belegt der deutsche Katalog dieselbe Serienkennung mit mindestens einer deutschen Folge, bleibt jeder
 * Weg auf eine deutsche Adresse (`/de/…`) stehen: Das US-Nein sagt nichts über die deutsche Tonspur.
 * Ohne deutsche Folge (My Teen Romantic Comedy SNAFU: drei Staffeln, 0 deutsche Folgen, 24.10.2026)
 * fehlt der Beleg, und der Weg fällt wie bisher. Meldet ein deutscher Satz die Serie als tot, entfernt
 * ihn die Bau-Phase selbst, auch ohne diesen Schutz.
 */

/** Kennungen, bei denen der deutsche Katalog in mindestens einer Staffel eine deutsche Folge zählt. */
export function deutschBelegtSerie(crDub: CrDubData): Set<string> {
  const ids = crDub.serien
    .filter((s) => s.katalog === 'de' && s.seriesId && (s.staffeln ?? []).some((st) => st.deutsch > 0))
    .map((s) => s.seriesId as string)
  return new Set(ids)
}

/** Zeigt der Weg auf die deutsche Fassung der Seite (Pfad beginnt mit `/de/`)? */
export function istDeutscheAdresse(url: string): boolean {
  return /^https?:\/\/(www\.)?crunchyroll\.com\/de\//.test(url)
}
