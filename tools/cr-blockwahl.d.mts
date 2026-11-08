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
}
export interface BlockWahl {
  treffer: { block: CrStaffel; url: string } | null
  weg?: 'zahl' | 'einzig' | 'name' | 'folgen'
  grund?: string
}
export function blockWahl(serien: CrSerie[], kennung: string, titel: BlockTitel): BlockWahl
