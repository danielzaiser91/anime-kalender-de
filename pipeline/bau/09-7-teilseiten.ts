import type { Title } from '../../shared/types.ts'
import type { CrDubData } from '../lib/crunchyroll-dub.ts'
import { setzeCrTeilseiten } from './09-7-cr-teilseiten.ts'
import { setzePrimeTeilseiten } from './09-7-prime-teilseiten.ts'

/** Geteilte Anbieterseiten: je Anbieter der Folgenbereich, wo er belegt ist (`sharedWith` muss gesetzt sein). */
export function setzeTeilseiten(titles: Map<number, Title>, crDub: CrDubData): void {
  setzeCrTeilseiten(titles, crDub)
  setzePrimeTeilseiten(titles)
}
