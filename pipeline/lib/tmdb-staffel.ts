/**
 * **Welche Staffel einer TMDB-Serie ist unser Titel?** AniList führt jede Staffel, jedes OVA und jeden Film als eigenen Titel; TMDB hat eine Serie mit
 * Staffeln, und nur die Serie trägt bei uns eine Zuordnung (`data/tmdb-titles.json`). Das Plakat der Staffel (`/tv/{id}/season/{n}/images`) ist das
 * des Titels — aber nur, wenn die Staffel sicher dieselbe ist.
 *
 * **Sicher heißt beides:** der Beginn liegt höchstens 100 Tage neben unserem japanischen Start **und** die Folgenzahl weicht um höchstens eine ab.
 * Specials (Staffel 0), Filme und OVAs ohne eigene Staffel bleiben ohne Treffer und damit beim AniList-Cover — ein Serienplakat für ein
 * OVA wäre eine Behauptung, die TMDB nicht stützt.
 */
export interface TmdbStaffel {
  season_number: number
  air_date?: string | null
  episode_count?: number
}

const TAGE = 864e5
const ABSTAND_TAGE = 100

export function waehleStaffel(staffeln: TmdbStaffel[], jpStart: string | undefined, folgen: number | undefined): number | undefined {
  const start = Date.parse(jpStart ?? '')
  if (!Number.isFinite(start)) return undefined
  const passend = staffeln.filter(
    (s) =>
      s.season_number > 0 &&
      s.air_date &&
      Math.abs(Date.parse(s.air_date) - start) < ABSTAND_TAGE * TAGE &&
      (!folgen || Math.abs((s.episode_count ?? 0) - folgen) <= 1),
  )
  /* Zwei Staffeln, die beides erfüllen, sind keine Auskunft: lieber keine als die falsche. */
  return passend.length === 1 ? passend[0]!.season_number : undefined
}
