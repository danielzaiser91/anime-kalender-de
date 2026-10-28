/**
 * Setzt aus Cache + kuratierten Daten die Dateien zusammen, die die Web-App lädt.
 * Ausgabe landet in public/data/ und wird mit ins Repo committet.
 *
 * Die Phasen liegen in `pipeline/bau/NN-*.ts`, die Nummer ist die Aufrufreihenfolge. Was eine
 * Phase braucht und liefert, steht in ihrer Signatur — die Reihenfolge hier ist Teil der Logik
 * (z. B. kommen die Disc-Wege in `schliesseWegeAb` erst nach der letzten Entfernung).
 */
import { ladeQuellen } from './bau/01-quellen.ts'
import { baueTitelGemessen } from './bau/anisearch-abweichungen.ts'
import { fuehreReihenZusammenQuelle as fuehreReihenZusammen } from './bau/anisearch-reihen-rein-bau.ts'
import { indiziereCrSendeplaetze } from './bau/04-cr-sendeplaetze.ts'
import { baueReleases } from './bau/05-releases.ts'
import { ergaenzeCrReleases } from './bau/06-cr-release-vermerke.ts'
import { ergaenzeAdnTitel } from './bau/07-adn.ts'
import { ergaenzeTermineAusNewsUndTv } from './bau/08-news-tv.ts'
import { pruefeSynchroJePlattform } from './bau/09-synchro.ts'
import { rolleTermineAusMitKomplettabwurf } from './bau/10-komplettabwurf.ts'
import { schliesseWegeAb } from './bau/11-wege-abschluss.ts'
import { stelleZurueck, vermerkeQuarantaene } from './bau/11-9-quarantaene.ts'
import { baueMeta } from './bau/12-meta.ts'
import { schreibeDatensatzGemessen } from './bau/anisearch-reihen-abweichungen.ts'
import { schreibeEmpfehlung } from './bau/13-10-empfehlung.ts'
import { schreibeAboFeeds } from './bau/14-ics.ts'
import { entferneVomKalender } from './bau/sperre.ts'
import { type EntfernterVerweis } from './bau/grundlagen.ts'
import { haltePunkt, pruefeSchalter } from './bau/phasen-zustand.ts'
import { merkeBestandVorher } from './lib/bestand-vorher.ts'
import type { ZurueckgestellterTitel } from '../shared/meta-typ.ts'

function main(): void {
  /**
   * **Jeder entfernte Verweis mit seinem Grund — vollständig** (Anlass 29.08.2026: 46 Titel ohne
   * Weg und ohne Begründung). Jede Phase, die einen entfernt, trägt ihn hier mit Grund ein.
   */
  const verweiseEntfernt: EntfernterVerweis[] = []
  const quellen = ladeQuellen()
  const { byMal, byAniId, tmdbTitles, anisearch, curated, curatedIds, tmdb, anisearchEpisodes, tmdbMehrdeutig } =
    quellen

  const { titles, jpStart, jpStartAnzeige } = baueTitelGemessen(quellen) // baueTitel plus Messung aniSearch gegen AniList (nichts wird ausgeliefert)
  haltePunkt('02-titel', titles)
  const { tvJeTmdb, toteAdressen, netflixOhneKennung } = fuehreReihenZusammen({
    byAniId,
    byMal,
    titles,
    tmdbTitles,
    anisearch,
  })

  const cr = indiziereCrSendeplaetze({ titles })
  const { usedCrKeys, seenSlugs, releases, unverified } = baueReleases({
    curated,
    curatedIds,
    titles,
    tmdb,
    anisearchEpisodes,
    findCrunchyroll: cr.findCrunchyroll,
    crKalenderBis: cr.crKalenderBis,
    crunchyroll: cr.crunchyroll,
  })
  ergaenzeCrReleases({ ...cr, usedCrKeys, seenSlugs, releases, anisearchEpisodes, unverified })
  const { adnKatalog, adnVerweiseErgaenzt } = ergaenzeAdnTitel({
    titles,
    releases,
    titleByName: cr.titleByName,
    seenSlugs,
  })
  ergaenzeTermineAusNewsUndTv({ titles, releases })
  haltePunkt('08-news-tv', titles)

  const synchro = pruefeSynchroJePlattform({
    releases,
    titles,
    crBySeriesId: cr.crBySeriesId,
    tmdbMehrdeutig,
    tmdbTitles,
    tvJeTmdb,
    toteAdressen,
    netflixOhneKennung,
    anisearch,
    verweiseEntfernt,
    katalogEintraege: cr.katalogEintraege,
    adnKatalog,
    adnVerweiseErgaenzt,
  })
  haltePunkt('09-synchro', titles)

  const { events, mitStimmen, verschoben } = rolleTermineAusMitKomplettabwurf({ releases, titles, jpStart }); entferneVomKalender(releases, events)
  haltePunkt('10-komplettabwurf', titles)

  // Alles, was Verweise ändert, muss vor `baueMeta` stehen — dort beginnt die Auslieferung.
  schliesseWegeAb({ ...synchro, titles, anisearch, releases, tmdbMehrdeutig, toteAdressen, verweiseEntfernt })
  haltePunkt('11-wege-abschluss', titles)
  const quarantaene = stelleZurueck({ titles, releases, events })

  liefereAus({
    quarantaene,
    synchro,
    anisearch,
    tmdbTitles,
    mitStimmen,
    verschoben,
    verweiseEntfernt,
    titles,
    jpStartAnzeige,
    releases,
    events,
  })
}

type Auslieferung = Omit<Parameters<typeof schreibeDatensatzGemessen>[0], 'allTitles' | 'meta' | 'kanalJeAdresse' | 'motnTon'> & {
  synchro: Pick<ReturnType<typeof pruefeSynchroJePlattform>, 'kanalJeAdresse' | 'motnBelege' | 'motnTon'>
  quarantaene: ZurueckgestellterTitel[]
}

/** Ab `baueMeta` beginnt die Auslieferung: Meta, Datensatz, Abo-Feeds. */
function liefereAus({ synchro, quarantaene, ...rest }: Auslieferung): void {
  const { titles, releases, events } = rest
  const { allTitles, meta, platforms, genres, keywords } = baueMeta({
    titles,
    releases,
    events,
    motnBelege: synchro.motnBelege,
  })
  vermerkeQuarantaene(meta, quarantaene)
  const { newsFuerRss } = schreibeDatensatzGemessen({
    ...rest,
    allTitles,
    kanalJeAdresse: synchro.kanalJeAdresse,
    motnTon: synchro.motnTon,
    meta,
  })
  schreibeAboFeeds({ newsFuerRss, events, platforms, allTitles, genres, meta, keywords })
  schreibeEmpfehlung()
}

pruefeSchalter()
merkeBestandVorher()
main()
