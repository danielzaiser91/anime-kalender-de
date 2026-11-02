import { katalogNamen } from '../bau/katalog-namen.ts'
import { titelAusKatalogEintrag } from '../bau/katalog-titel.ts'
import type { KatalogEintrag } from './anilist.ts'

/* Chinesisches Werk ohne englischen Namen, AniList führt nur ein lateinisches Synonym. */
const EINTRAG: KatalogEintrag = {
  id: 900001,
  t: ['Guimi Zhi Zhu: Wu Mian Ren Pian', null, '诡秘之主 无面人篇'],
  latein: 'Lord of the Mysteries 2',
  format: 'ONA',
  jahr: 2025,
  folgen: 12,
  genres: [],
  score: null,
  cover: null,
  rel: [],
}

/** Beide Bau-Wege (Namen und Katalog-Titel) liefern den lateinischen Namen als englischen. */
export function lateinAlsEnglisch(): boolean {
  const namen = katalogNamen(EINTRAG, undefined, undefined)
  const titel = titelAusKatalogEintrag(EINTRAG)
  const ohne = titelAusKatalogEintrag({ ...EINTRAG, latein: null })
  return namen.titleEn === 'Lord of the Mysteries 2' && titel.titleEn === 'Lord of the Mysteries 2' && ohne.titleEn === undefined
}
