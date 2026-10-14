import type { Title } from '../../shared/types.ts'
import { bannerAdresse, type TmdbBanner } from './tmdb-banner.ts'

type Zuordnung = Record<string, { tmdbId?: number; kind?: string }>

/** Helfer der Lückenliste `listen/luecken/banner.md` (`luecken-felder.ts`). Warum ein Titel kein TMDB-Hintergrundbild hat. */
export function grundOhneBanner(id: number, bestand: TmdbBanner, zuordnung: Zuordnung): string {
  if (!zuordnung[String(id)]?.tmdbId) return 'keine TMDB-Zuordnung'
  if (!(String(id) in bestand)) return 'noch nicht abgefragt'
  return 'TMDB führt kein Querformat ab 1280 px'
}

/** Das TMDB-Bild eines anderen Titels derselben Reihe, als Vorschlag für den Ersatz (wird nicht selbst übernommen). */
export function bildDerReihe(t: Title, titel: Title[], bestand: TmdbBanner): string {
  const geschwister = titel.filter((x) => x.id !== t.id && (x.franchiseId ?? x.id) === (t.franchiseId ?? t.id))
  const pfad = geschwister.map((x) => bestand[String(x.id)]?.p).find(Boolean)
  return pfad ? `[Bild der Reihe](${bannerAdresse(pfad)})` : '–'
}
