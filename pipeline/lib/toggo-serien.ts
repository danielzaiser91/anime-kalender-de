/**
 * **Von der Figurenseite zur Serienseite bei TOGGO** (19.09.2026).
 *
 * JustWatch und aniSearch verlinken TOGGO oft über die Figurenseite
 * (`toggo.de/beyblade-x-pty605`). Sie trägt keine Serienkennung, und dieselbe Figur
 * gehört zu mehreren Serien — `naruto-pty606` zu Naruto, Naruto Shippuden und Boruto,
 * `beyblade-x-pty605` zu Beyblade X und Beyblade Burst QuadStrike. Die Serienliste der
 * TOGGO-Schnittstelle (`type[series]`) nennt je Serie ihre Figuren; entschieden wird über
 * den Namen. Daniel am 19.09.2026: verlinkt wird die Serienseite,
 * `toggo.de/beyblade-x-pty605/serien/beyblade-x-vse359` — dort stehen die Folgen.
 */
import { namensKern } from '../fetch-tv-programm.ts'

export type ToggoSerie = { id: string; uname: string; titel: string; figuren: string[] }

/** Figur aus einer TOGGO-Adresse, nur für die blanke Figurenseite (keine Folge, kein Film). */
export const figurAusAdresse = (url: string): string | undefined =>
  /toggo\.de\/([a-z0-9-]+-pty\d+)\/?(?:[?#]|$)/i.exec(url)?.[1]?.toLowerCase()

/** Die Serie der Figur, deren Name einem unserer Namen gleicht — sonst keine. */
export function serieFuerFigur(serien: ToggoSerie[], figur: string, namen: (string | undefined)[]): ToggoSerie | undefined {
  const kerne = new Set(namen.filter(Boolean).map((n) => namensKern(n)))
  const treffer = serien.filter((s) => s.figuren.includes(figur) && kerne.has(namensKern(s.titel)))
  return treffer.length === 1 ? treffer[0] : undefined
}

export const serienAdresse = (figur: string, serie: ToggoSerie) => `https://www.toggo.de/${figur}/serien/${serie.uname}`
