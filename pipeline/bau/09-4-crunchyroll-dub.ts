import {
  type CrDubData
} from '../lib/crunchyroll-dub.ts'
import { type Title, type Release } from '../../shared/types.ts'
import { type EntfernterVerweis } from './grundlagen.ts'
import { type KatalogEintrag } from '../lib/anilist.ts'
import { type AnisearchEintrag } from './01-quellen.ts'
import { legeCrVerweiseUndTermineAn } from './09-4-4-termine.ts'
import { ordneCrKatalogZu } from './09-4-3-katalog.ts'
import { ordneCrBloeckeZu } from './09-4-2-bloecke.ts'
import { ordneCrSerienZu } from './09-4-1-serien.ts'
import { ordneStandardnamenBloeckeZu } from '../lib/cr-block-standardname.ts'
import { ordneFolgestaffelBloeckeZu } from '../lib/cr-folgestaffel.ts'
import { loadDubChecks, neinHandbelege } from '../lib/dub-confirmed.ts'
import { log } from '../lib/util.ts'

export function werteCrunchyrollDubAus({
  crDub,
  titles,
  usNeinWiderlegt,
  verweiseEntfernt,
  katalogEintraege,
  anisearch,
  releases,
}: {
  titles: Map<number, Title>
  usNeinWiderlegt: (serie: { nichtVerfuegbar?: boolean; katalog?: string; seriesId?: string | null; }) => boolean
  verweiseEntfernt: EntfernterVerweis[]
  katalogEintraege: KatalogEintrag[]
  anisearch: Record<string, AnisearchEintrag>
  releases: Release[]
  crDub: CrDubData
}) {
  if (crDub.serien.length) {
    const { nachUrl, belegt, verschwunden, usNeinOffen } = ordneCrSerienZu({
      titles,
      crDub,
      usNeinWiderlegt,
      verweiseEntfernt,
    })

    ordneCrBloeckeZu({ crDub, nachUrl, titles, katalogEintraege })

    ordneStandardnamenBloeckeZu({ crDub, nachUrl })

    const folgestaffeln = ordneFolgestaffelBloeckeZu({ crDub, nachUrl, titles, handNein: neinHandbelege(loadDubChecks()) })
    if (folgestaffeln.length) log(`${folgestaffeln.length} Folgestaffeln über ihren deutschen Block „Staffel N“ belegt`)

    ordneCrKatalogZu({ titles, crDub, verweiseEntfernt })

    legeCrVerweiseUndTermineAn({ titles, anisearch, belegt, crDub, verschwunden, usNeinOffen, nachUrl, releases })

    /* Geschrieben wird erst am Ende — nach der letzten Stelle, die entfernt. */
  }
}
