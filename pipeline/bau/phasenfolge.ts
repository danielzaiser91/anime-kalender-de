/**
 * Die Phasenfolge von den geladenen Rohquellen bis zu den Eingaben der Auslieferung (`liefereAus` in
 * `build.ts`). Die Reihenfolge ist Teil der Logik (z. B. kommen die Disc-Wege in `schliesseWegeAb`
 * erst nach der letzten Entfernung); Eingaben kommen als Parameter, das Ergebnis als Rückgabe.
 */
import { baueTitelGemessen } from './anisearch-abweichungen.ts'
import { fuehreReihenZusammenQuelle as fuehreReihenZusammen } from './anisearch-reihen-rein-bau.ts'
import { indiziereCrSendeplaetze } from './04-cr-sendeplaetze.ts'
import { baueReleases } from './05-releases.ts'
import { ergaenzeCrReleases } from './06-cr-release-vermerke.ts'
import { ergaenzeAdnTitel } from './07-adn.ts'
import { ergaenzeTermineAusNewsUndTv } from './08-news-tv.ts'
import { pruefeSynchroJePlattform } from './09-synchro.ts'
import { rolleTermineAusMitKomplettabwurf } from './10-komplettabwurf.ts'
import { schliesseWegeAb } from './11-wege-abschluss.ts'
import { stelleZurueck } from './11-9-quarantaene.ts'
import { entferneVomKalender } from './sperre.ts'
import { type EntfernterVerweis } from './grundlagen.ts'
import { meldeBilanz } from './phasen-bilanz.ts'
import { haltePunkt } from './phasen-zustand.ts'
import type { ladeQuellen } from './01-quellen.ts'

/** Was die Phasenfolge der Auslieferung übergibt. */
export type Phasenergebnis = {
  quarantaene: ReturnType<typeof stelleZurueck>
  synchro: ReturnType<typeof pruefeSynchroJePlattform>
  anisearch: ReturnType<typeof ladeQuellen>['anisearch']
  tmdbTitles: ReturnType<typeof ladeQuellen>['tmdbTitles']
  mitStimmen: ReturnType<typeof rolleTermineAusMitKomplettabwurf>['mitStimmen']
  verschoben: ReturnType<typeof rolleTermineAusMitKomplettabwurf>['verschoben']
  /**
   * **Jeder entfernte Verweis mit seinem Grund — vollständig** (Anlass 29.08.2026: 46 Titel ohne
   * Weg und ohne Begründung). Jede Phase, die einen entfernt, trägt ihn hier mit Grund ein.
   */
  verweiseEntfernt: EntfernterVerweis[]
  titles: ReturnType<typeof baueTitelGemessen>['titles']
  jpStartAnzeige: ReturnType<typeof baueTitelGemessen>['jpStartAnzeige']
  releases: ReturnType<typeof baueReleases>['releases']
  events: ReturnType<typeof rolleTermineAusMitKomplettabwurf>['events']
}

export function bauePhasenfolge(quellen: ReturnType<typeof ladeQuellen>): Phasenergebnis {
  const verweiseEntfernt: EntfernterVerweis[] = []
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
  meldeBilanz({ phase: '05-releases', titel: titles.size, releases: releases.length, kuratiert: curated.length })
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

  const { events, mitStimmen, verschoben } = rolleTermineAusMitKomplettabwurf({ releases, titles, jpStart })
  entferneVomKalender(releases, events)
  meldeBilanz({ phase: '10-komplettabwurf', titel: titles.size, releases: releases.length, events: events.length, kuratiert: curated.length })
  haltePunkt('10-komplettabwurf', titles)

  // Alles, was Verweise ändert, muss vor `baueMeta` stehen — dort beginnt die Auslieferung.
  schliesseWegeAb({ ...synchro, titles, anisearch, releases, tmdbMehrdeutig, toteAdressen, verweiseEntfernt })
  haltePunkt('11-wege-abschluss', titles)
  const quarantaene = stelleZurueck({ titles, releases, events })

  return {
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
  }
}
