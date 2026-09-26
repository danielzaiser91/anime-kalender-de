import { type Title, type Release } from '../../shared/types.ts'
import { type CrunchyrollEntry } from '../lib/crunchyroll.ts'
import { type CrDubData } from '../lib/crunchyroll-dub.ts'
import { type AdnData } from '../lib/adn.ts'
import { type KatalogEintrag } from '../lib/anilist.ts'
import { readJson } from '../lib/util.ts'
import { type EntfernterVerweis } from './grundlagen.ts'
import { type AnisearchEintrag, type TmdbTitelEintrag } from './01-quellen.ts'
import { sammleBelege } from './09-1-belege.ts'
import { werteLinkpruefungAus } from './09-2-linkpruefung.ts'
import { uebernehmePrimeUndCrVorschlaege } from './09-3-prime.ts'
import { werteCrunchyrollDubAus } from './09-4-crunchyroll-dub.ts'
import { werteWeitereQuellenAus } from './09-5-weitere-quellen.ts'
import { ergaenzeAnisearchWege } from './09-6-anisearch-wege.ts'
import { schliesseSynchroAb } from './09-7-abschluss.ts'

/**
 * Synchro-Verfügbarkeit je Plattform: Ein Stream-Link allein sagt nichts über die Sprache —
 * belegt ist die Synchro nur dort, wo sie nachgewiesen wurde. Die Teilschritte liegen in
 * `09-N-*.ts` in Aufrufreihenfolge.
 */
export function pruefeSynchroJePlattform({
  releases,
  titles,
  crBySeriesId,
  tmdbMehrdeutig,
  tmdbTitles,
  tvJeTmdb,
  toteAdressen,
  netflixOhneKennung,
  anisearch,
  verweiseEntfernt,
  katalogEintraege,
  adnKatalog,
  adnVerweiseErgaenzt,
}: {
  releases: Release[]
  titles: Map<number, Title>
  crBySeriesId: Map<string, CrunchyrollEntry>
  tmdbMehrdeutig: Set<string>
  tmdbTitles: Record<string, TmdbTitelEintrag>
  tvJeTmdb: Set<string>
  toteAdressen: Set<string>
  netflixOhneKennung: number
  anisearch: Record<string, AnisearchEintrag>
  verweiseEntfernt: EntfernterVerweis[]
  katalogEintraege: KatalogEintrag[]
  adnKatalog: AdnData
  adnVerweiseErgaenzt: number
}) {
  const crDub = readJson<CrDubData>('data/crunchyroll-dub.json', { scrapedAt: '', serien: [] })
  const belege = sammleBelege({ releases, titles, crBySeriesId, tmdbMehrdeutig, tmdbTitles, tvJeTmdb, toteAdressen, crDub })
  const pruefung = werteLinkpruefungAus({ ...belege, titles, netflixOhneKennung })
  uebernehmePrimeUndCrVorschlaege({ ...belege, ...pruefung, titles, tmdbTitles, anisearch })
  werteCrunchyrollDubAus({
    crDub,
    titles,
    usNeinWiderlegt: belege.usNeinWiderlegt,
    verweiseEntfernt,
    katalogEintraege,
    anisearch,
    releases,
  })
  const { adnArchiv, adnStreamSchaerfen, motnBelege } = werteWeitereQuellenAus({
    releases,
    titles,
    adnKatalog,
    adnVerweiseErgaenzt,
    verweiseEntfernt,
  })
  ergaenzeAnisearchWege({
    ...belege,
    ...pruefung,
    verweiseEntfernt,
    crDub,
    titles,
    anisearch,
    adnArchiv,
    adnStreamSchaerfen,
  })
  schliesseSynchroAb({ titles, verweiseEntfernt, releases, crDub, belegFuer: belege.belegFuer })

  const { zugangJeAdresse, crAdresseZu, beantworteteSuchen, suchOffen, alleChecks, checksJePlattform, kanalJeAdresse } =
    belege
  const { linkBefunde, lautPruefungTot } = pruefung
  return {
    zugangJeAdresse,
    linkBefunde,
    crAdresseZu,
    beantworteteSuchen,
    suchOffen,
    alleChecks,
    lautPruefungTot,
    checksJePlattform,
    motnBelege,
    kanalJeAdresse,
  }
}
