/**
 * **Staffeln der Cartoons** (11.10.2026): zwei Quellen, eine gewinnt. JustWatch (anbieternah: so zählt der Anbieter)
 * schlägt TMDB; widersprechen sie sich, bleibt es bei JustWatch, und der Titel kommt mit Grund auf die Prüfliste.
 * Gemessen an 13 Titeln stimmten beide nur bei 7 überein (Jack: JustWatch falsch, PJ Masks: TMDB falsch) —
 * deshalb nie still eine von beiden glauben.
 */
import type { CartoonStaffel } from '../../shared/cartoon-staffeln-typ.ts'
import type { Staffel } from './jw-staffeln.ts'

/** Wie weit die Summe der Staffeln von der Gesamtfolgenzahl abweichen darf (Vorgabe 11.10.2026). */
export const SUMMEN_TOLERANZ = 3

export interface TmdbStaffelRoh {
  season_number?: number
  episode_count?: number
  air_date?: string | null
}

export interface Staffelwahl {
  staffeln: CartoonStaffel[]
  quelle: 'justwatch' | 'tmdb'
  /** Gründe für die Prüfliste; leer = nichts zu prüfen. */
  gruende: string[]
}

function ordnen(liste: CartoonStaffel[]): CartoonStaffel[] | undefined {
  const sortiert = liste.sort((a, b) => a.nr - b.nr).filter((s, i, alle) => i === 0 || alle[i - 1].nr !== s.nr)
  return sortiert.length ? sortiert : undefined
}

/** TMDB-Staffeln; Staffel 0 („Extras“) und leere Staffeln zählen nicht. */
export function tmdbStaffeln(seasons: TmdbStaffelRoh[] | null | undefined): CartoonStaffel[] | undefined {
  const liste = (seasons ?? []).flatMap((s) => {
    const nr = s.season_number
    const folgen = s.episode_count
    if (!nr || nr < 1 || !folgen || folgen < 1) return []
    return [{ nr, folgen, ...(s.air_date ? { start: s.air_date } : {}) }]
  })
  return ordnen(liste)
}

/** JustWatch-Staffeln mit Folgenzahl; Staffel 0 und Staffeln ohne Zahl zählen nicht. */
export function jwStaffeln(staffeln: Pick<Staffel, 'nr' | 'folgen'>[] | null | undefined): CartoonStaffel[] | undefined {
  const liste = (staffeln ?? []).flatMap((s) => (s.nr >= 1 && s.folgen && s.folgen >= 1 ? [{ nr: s.nr, folgen: s.folgen }] : []))
  return ordnen(liste)
}

export function summe(staffeln: CartoonStaffel[]): number {
  return staffeln.reduce((n, s) => n + s.folgen, 0)
}

const beschreibe = (s: CartoonStaffel[]) => `${s.length} Staffel${s.length === 1 ? '' : 'n'}, ${summe(s)} Folgen`

function gleich(a: CartoonStaffel[], b: CartoonStaffel[]): boolean {
  return a.length === b.length && a.every((s, i) => s.nr === b[i].nr && s.folgen === b[i].folgen)
}

/** Den Starttag von TMDB übernehmen, wo es dieselbe Staffel mit derselben Folgenzahl führt (sonst wäre es ein fremdes Datum). */
function mitStart(jw: CartoonStaffel[], tmdb: CartoonStaffel[] | undefined): CartoonStaffel[] {
  return jw.map((s) => {
    const start = tmdb?.find((t) => t.nr === s.nr && t.folgen === s.folgen)?.start
    return start ? { ...s, start } : s
  })
}

/** Die Staffeln eines Cartoons; `gesamt` ist die Gesamtfolgenzahl des Titels (TMDB), `undefined` ohne Staffelangabe. */
export function waehleStaffeln(
  jw: CartoonStaffel[] | undefined,
  tmdb: CartoonStaffel[] | undefined,
  gesamt: number | undefined,
): Staffelwahl | undefined {
  const staffeln = jw ? mitStart(jw, tmdb) : tmdb
  if (!staffeln) return undefined
  const quelle = jw ? 'justwatch' : 'tmdb'
  const gruende: string[] = []
  if (jw && tmdb && !gleich(jw, tmdb)) {
    gruende.push(`Quellen widersprechen sich: JustWatch ${beschreibe(jw)}, TMDB ${beschreibe(tmdb)}`)
  }
  if (gesamt && Math.abs(summe(staffeln) - gesamt) > SUMMEN_TOLERANZ) {
    gruende.push(`Staffelsumme ${summe(staffeln)} (${quelle === 'tmdb' ? 'TMDB' : 'JustWatch'}) weicht von der Gesamtfolgenzahl ${gesamt} ab`)
  }
  return { staffeln, quelle, gruende }
}
