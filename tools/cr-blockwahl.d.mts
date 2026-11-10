import type { CrSerie, CrStaffel } from '../pipeline/lib/crunchyroll-dub.ts'

export interface BlockTitel {
  /** Staffelnummern, die zum Titel passen (`katalogStaffeln`); leer, wenn unklar. */
  nummern: number[]
  /** Namen, unter denen der Titel im Katalog stehen kann. */
  namen?: string[]
  /** Folgenzahl des Titels bzw. Termins. */
  folgen?: number
  /** Ein anderer Titel hat einen Weg zu derselben Serie. */
  geteilt?: boolean
  /** Berliner Starttag des OmU-Termins (YYYY-MM-DD); Blöcke ohne deutsche Folge ab dann scheiden für die Wege ohne Zahl aus. */
  ab?: string
  /** Die Staffelnummern stammen nur aus dem Namen des Termins (Wache), nicht aus der Reihe (Bau): Grundnamen vor Folgestaffeln scheiden aus. */
  nummernAusName?: boolean
  /** Namen der anderen Titel an derselben Serie: ein Titel ohne Staffel 1 darf über den Namen keinen Block der Vorstaffel wählen. */
  andereNamen?: string[]
}
export interface BlockWahl {
  treffer: { block: CrStaffel; url: string } | null
  weg?: 'zahl' | 'einzig' | 'name' | 'folgen'
  grund?: string
}
export function blockName(name: string): string
export function blockWahl(serien: CrSerie[], kennung: string, titel: BlockTitel): BlockWahl
export function istPlatzhalter(folge: { verfuegbarAb?: string }): boolean
