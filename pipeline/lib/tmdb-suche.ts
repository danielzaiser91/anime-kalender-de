import { passtFilm } from './tmdb-plakat.ts'

/** Ein Treffer der TMDB-Suche (`/search/movie` und `/search/tv`, dort heißen Name und Datum anders). */
export interface TmdbTreffer {
  id: number
  title?: string
  original_title?: string
  name?: string
  original_name?: string
  release_date?: string
  first_air_date?: string
  genre_ids?: number[]
}

const ANIMATION = 16

const jahrVon = (r: TmdbTreffer): number => Number((r.release_date ?? r.first_air_date ?? '').slice(0, 4))

/**
 * Der sichere Treffer unter den Suchergebnissen, sonst keiner (lieber kein Cover als ein falsches). Sicher heißt: Name wie einer unserer Namen
 * (`passtFilm`), Jahr auf beiden Seiten bekannt und höchstens um eins verschieden, Genre Animation. Unter mehreren nimmt der mit dem kleinsten
 * Jahresabstand; bleiben zwei verschiedene Werke gleich nah, ist es unsicher.
 */
export function besterTreffer(namen: (string | undefined)[], jahr: number | undefined, ergebnisse: TmdbTreffer[]): TmdbTreffer | undefined {
  if (!jahr) return undefined
  const passend = ergebnisse
    .slice(0, 10)
    .filter((r) => r.genre_ids?.includes(ANIMATION) && jahrVon(r) > 0)
    .filter((r) => passtFilm(namen, jahr, { title: r.title ?? r.name, original_title: r.original_title ?? r.original_name, release_date: r.release_date ?? r.first_air_date }))
    .map((r) => ({ r, abstand: Math.abs(jahrVon(r) - jahr) }))
    .sort((a, b) => a.abstand - b.abstand)
  if (passend[1] && passend[1].abstand === passend[0]!.abstand && passend[1].r.id !== passend[0]!.r.id) return undefined
  return passend[0]?.r
}
