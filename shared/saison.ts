/** Die vier Anime-Saisons Japans; `jpSeason` am Titel nutzt dieselben Namen wie AniList. */
export type Saison = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL'
export interface SaisonTag {
  jahr: number
  saison: Saison
}

const FOLGE: Saison[] = ['WINTER', 'SPRING', 'SUMMER', 'FALL']
export const SAISON_NAME: Record<Saison, string> = { WINTER: 'Winter', SPRING: 'Frühling', SUMMER: 'Sommer', FALL: 'Herbst' }

/** Die Saison eines Datums (`JJJJ-MM-TT`): Januar bis März Winter, April bis Juni Frühling, Juli bis September Sommer, Rest Herbst. */
export function saisonVon(datum: string): SaisonTag {
  const monat = Number(datum.slice(5, 7))
  return { jahr: Number(datum.slice(0, 4)), saison: FOLGE[Math.min(3, Math.floor((monat - 1) / 3))]! }
}

/** Die Saison davor (`-1`) oder danach (`+1`). */
export function versetzt(s: SaisonTag, schritt: -1 | 1): SaisonTag {
  const nr = FOLGE.indexOf(s.saison) + schritt
  return nr < 0 ? { jahr: s.jahr - 1, saison: 'FALL' } : nr > 3 ? { jahr: s.jahr + 1, saison: 'WINTER' } : { jahr: s.jahr, saison: FOLGE[nr]! }
}

export const saisonText = (s: SaisonTag): string => `${SAISON_NAME[s.saison]} ${s.jahr}`

/** Erster und letzter Tag der Saison als `JJJJ-MM-TT`. */
export function saisonZeitraum(s: SaisonTag): [string, string] {
  const von = FOLGE.indexOf(s.saison) * 3 + 1
  const tag = (m: number) => String(m).padStart(2, '0')
  return [`${s.jahr}-${tag(von)}-01`, `${s.jahr}-${tag(von + 2)}-31`]
}

/** Fernseh- und Web-Serien — Filme, OVAs und Specials gehören nicht in den Saison-Überblick. */
export const istSerie = (format: string | undefined): boolean => format === 'TV' || format === 'ONA'
