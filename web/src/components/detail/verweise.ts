/**
 * **Wohin die Absprünge aus dem Detail-Panel führen** (Daniel, 29.09.2026): „anisearch absprünge aus
 * detail panel besser hervorheben (pille?) und mit ? kennzeichnen wenn es auf suche führt, statt
 * direkt auf titel. außerdem über anisearch mal absprung-link anzeigen, falls wir einen haben der
 * direkt zum titel springt (zB bei „1/100 SHIBUYA Crossing" gibt es keine anisearch seite, aber eine
 * MAL seite.)".
 *
 * Eigenes Modul, weil `pillen.tsx` an der 800-Zeilen-Grenze lag — und weil die **Wege** hier ohne
 * HTML lesbar und prüfbar sind (`check:logic`).
 *
 * Die Regel je Nachschlagewerk:
 * - **aniSearch mit Kennung** → Titelseite; **ohne Kennung** → Suche, und dann trägt die Pille ein
 *   „?" (eine geratene Nummer führte auf ein fremdes Werk — dieselbe Falle wie bei den erfundenen
 *   Amazon-Adressen vom 23.08.2026).
 * - **MAL nur mit Kennung**: Eine Suchadresse wäre kein „Sprung zum Titel" und damit kein
 *   Versprechen, das wir halten können.
 * - **Westliche Titel** (Cartoons) führt aniSearch nicht — dort steht der Weg zu TMDB, woher ihre
 *   Angaben stammen (16.09.2026).
 */
import type { Title } from '@shared/types.ts'
import { anzeigeName } from '@shared/titles.ts'

export interface Verweis {
  name: string
  ziel: string
  /** Führt auf die Suche statt auf die Titelseite — dann trägt die Pille ein „?". */
  suche?: boolean
  /** Wohin der Weg führt, in Worten — für den Tooltip. */
  hinweis: string
}

export function verweiseFuer(title: Title): Verweis[] {
  const raus: Verweis[] = []
  const tmdb = title.westlich && title.tmdbId ? `https://www.themoviedb.org/tv/${title.tmdbId}` : undefined
  if (tmdb) raus.push({ name: 'TMDB', ziel: tmdb, hinweis: 'Bei TMDB ansehen' })
  else if (title.anisearchId)
    raus.push({
      name: 'aniSearch',
      ziel: `https://www.anisearch.de/anime/${title.anisearchId}`,
      hinweis: 'Bei aniSearch ansehen',
    })
  else
    raus.push({
      name: 'aniSearch',
      ziel: `https://www.anisearch.de/search?q=${encodeURIComponent(anzeigeName(title))}`,
      suche: true,
      hinweis: 'Bei aniSearch suchen — eine eigene Seite kennen wir nicht',
    })
  if (title.malId) raus.push({ name: 'MAL', ziel: `https://myanimelist.net/anime/${title.malId}`, hinweis: 'Bei MyAnimeList ansehen' })
  return raus
}
