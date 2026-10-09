/**
 * **Wohin die Absprünge aus dem Detail-Panel führen.** Nur Direktlinks auf die Titelseite; eine Suche gibt es nie (Daniel, 09.10.2026: bei „The Boxer"
 * und „Laid Off Cheat Granting Mage" stand eine Suchseite bzw. ein „?" — das darf nie wieder passieren).
 *
 * Eigenes Modul, weil `pillen.tsx` an der 800-Zeilen-Grenze lag — und weil die **Wege** hier ohne HTML lesbar und prüfbar sind (`check:logic`).
 *
 * Die Regel je Nachschlagewerk:
 * - **aniSearch nur mit Kennung** → Titelseite; ohne Kennung steht der Eintrag nicht da (der Bau führt die Titel ohne Kennung in
 *   `data/anisearch-offen.json` und ordnet nach, sobald aniSearchs Brücke eine liefert).
 * - **MAL nur mit Kennung**: Eine Suchadresse wäre kein „Sprung zum Titel".
 * - **Westliche Titel** (Cartoons) führt aniSearch nicht — dort steht der Weg zu TMDB, woher ihre Angaben stammen (16.09.2026).
 */
import type { Title } from '@shared/types.ts'

export interface Verweis {
  name: string
  ziel: string
  /** Wohin der Weg führt, in Worten — für den Tooltip. */
  hinweis: string
}

/** `asZiel`: die kanonische aniSearch-Adresse mit Slug, wo die Beschreibung sie schon trägt (Panel, `deSource`). */
export function verweiseFuer(title: Title, asZiel?: string): Verweis[] {
  const raus: Verweis[] = []
  const tmdb = title.westlich && title.tmdbId ? `https://www.themoviedb.org/tv/${title.tmdbId}` : undefined
  if (tmdb) raus.push({ name: 'TMDB', ziel: tmdb, hinweis: 'Bei TMDB ansehen' })
  else if (title.anisearchId)
    raus.push({
      name: 'aniSearch',
      ziel: asZiel ?? `https://www.anisearch.de/anime/${title.anisearchId}`,
      hinweis: 'Bei aniSearch ansehen',
    })
  if (title.malId) raus.push({ name: 'MAL', ziel: `https://myanimelist.net/anime/${title.malId}`, hinweis: 'Bei MyAnimeList ansehen' })
  return raus
}
