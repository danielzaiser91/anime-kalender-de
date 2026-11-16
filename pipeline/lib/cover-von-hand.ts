import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { ROOT } from './util.ts'
import { TMDB_BILD, type TmdbPlakate } from './cover-quelle.ts'

/** Zeile von `data/cover-von-hand.yaml`: `plakatVon` ist die Kennung des Titels, dessen TMDB-Plakat `id` zeigt (Neufassung desselben Films ohne eigenen TMDB-Eintrag). */
export interface CoverVonHand {
  id: number
  plakatVon: number
  grund: string
}

/** Titelkennung → Kennung des Titels, dessen Plakat er bekommt. */
export type PlakatVon = Record<string, number>

export function ladePlakatVon(wurzel: string = ROOT): PlakatVon {
  const datei = resolve(wurzel, 'data/cover-von-hand.yaml')
  const zeilen = existsSync(datei) ? ((yaml.load(readFileSync(datei, 'utf8')) as CoverVonHand[] | null) ?? []) : []
  return Object.fromEntries(zeilen.map((z) => [String(z.id), z.plakatVon]))
}

/** Letzter Rückfall der Cover-Regel: das TMDB-Plakat des benannten Titels; ohne Eintrag, ohne Plakat oder ohne `p` keins. */
export function coverVonHand(titelId: number, hand: PlakatVon, plakate: TmdbPlakate): string | undefined {
  const von = hand[String(titelId)]
  const plakat = von === undefined ? undefined : plakate[String(von)]
  return plakat?.p ? `${TMDB_BILD}${plakat.p}` : undefined
}
