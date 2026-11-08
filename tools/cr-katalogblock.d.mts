import type { CrSerie, CrStaffel } from '../pipeline/lib/crunchyroll-dub.ts'

export const STAFFEL_IM_NAMEN: RegExp
export interface DeutscheFolge {
  tag: string
  zeit: string
  laufend?: number
  ms: number
}
export function nachBerlin(iso: string): { datum: string; zeit: string } | null
export function katalogBlock(serien: CrSerie[], kennung: string, nummern: number[]): { block: CrStaffel; url: string } | null
export function datierteFolgen(block: CrStaffel): DeutscheFolge[]
export function folgenAbOmuStart(folgen: DeutscheFolge[], startTag: string): DeutscheFolge[]
