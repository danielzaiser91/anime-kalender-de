/**
 * Setzt aus Cache + kuratierten Daten die Dateien zusammen, die die Web-App lädt.
 * Ausgabe landet in public/data/ und wird mit ins Repo committet.
 *
 * Die Phasen liegen in `pipeline/bau/NN-*.ts`, die Nummer ist die Aufrufreihenfolge. Was eine
 * Phase braucht und liefert, steht in ihrer Signatur — die Reihenfolge hier ist Teil der Logik
 * (z. B. kommen die Disc-Wege in `schliesseWegeAb` erst nach der letzten Entfernung).
 */
import { ladeQuellen } from './bau/01-quellen.ts'
import { baueTitel } from './bau/02-titel.ts'
import { fuehreReihenZusammen } from './bau/03-reihen.ts'
import { indiziereCrSendeplaetze } from './bau/04-cr-sendeplaetze.ts'
import { baueReleases } from './bau/05-releases.ts'
import { ergaenzeCrSimuldubs } from './bau/06-cr-simuldubs.ts'
import { ergaenzeAdnTitel } from './bau/07-adn.ts'
import { ergaenzeTermineAusNewsUndTv } from './bau/08-news-tv.ts'
import { pruefeSynchroJePlattform } from './bau/09-synchro.ts'
import { rolleTermineAus } from './bau/10-termine.ts'
import { schliesseWegeAb } from './bau/11-wege-abschluss.ts'
import { baueMeta } from './bau/12-meta.ts'
import { schreibeDatensatz } from './bau/13-schreiben.ts'
import { schreibeAboFeeds } from './bau/14-ics.ts'
import { type EntfernterVerweis } from './bau/grundlagen.ts'

function main(): void {
  /**
   * **Jeder entfernte Verweis mit seinem Grund — vollständig.** Ein Verweis, der verschwindet, ist
   * die folgenreichste Änderung, die dieser Bau macht; jede Phase, die einen entfernt, trägt ihn
   * hier mit Grund ein (Anlass 29.08.2026: 46 Titel ohne Weg und ohne Begründung).
   */
  const verweiseEntfernt: EntfernterVerweis[] = []
  const quellen = ladeQuellen()
  const { byMal, byAniId, tmdbTitles, anisearch, curated, curatedIds, tmdb, anisearchEpisodes, tmdbMehrdeutig } =
    quellen

  const { titles, jpStart, jpStartAnzeige } = baueTitel(quellen)
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
  ergaenzeCrSimuldubs({ ...cr, usedCrKeys, seenSlugs, releases, anisearchEpisodes, unverified })
  const { adnKatalog, adnVerweiseErgaenzt } = ergaenzeAdnTitel({
    titles,
    releases,
    titleByName: cr.titleByName,
    seenSlugs,
  })
  ergaenzeTermineAusNewsUndTv({ titles, releases })

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

  const { events, mitStimmen, verschoben } = rolleTermineAus({ releases, titles, jpStart })

  // Alles, was Verweise ändert, muss vor `baueMeta` stehen — dort beginnt die Auslieferung.
  schliesseWegeAb({ ...synchro, titles, anisearch, releases, tmdbMehrdeutig, toteAdressen, verweiseEntfernt })

  const { allTitles, meta, platforms, genres, keywords } = baueMeta({
    titles,
    releases,
    events,
    motnBelege: synchro.motnBelege,
  })
  const { newsFuerRss } = schreibeDatensatz({
    allTitles,
    releases,
    kanalJeAdresse: synchro.kanalJeAdresse,
    anisearch,
    tmdbTitles,
    mitStimmen,
    verschoben,
    verweiseEntfernt,
    titles,
    jpStartAnzeige,
    events,
    meta,
  })
  schreibeAboFeeds({ newsFuerRss, events, platforms, allTitles, genres, meta, keywords })
}

main()
