import {
  type Title, type Release, type ReleaseEvent,
  type DataMeta
} from '../../shared/types.ts'
import { type EntfernterVerweis } from './grundlagen.ts'
import { type AnisearchEintrag, type TmdbTitelEintrag } from './01-quellen.ts'
import { schreibeKernUndNews } from './13-5-kerndateien.ts'
import { schreibeZusatzdateien } from './13-4-zusatzdateien.ts'
import { schreibeListen } from './13-3-listen.ts'
import { baueAuslieferung } from './13-2-auslieferung.ts'
import { schreibeSynopsenUndReichereAn } from './13-1-anreichern.ts'

export function schreibeDatensatz({
  allTitles,
  releases,
  kanalJeAdresse,
  anisearch,
  tmdbTitles,
  mitStimmen,
  verschoben,
  verweiseEntfernt,
  titles,
  jpStartAnzeige,
  events,
  meta,
}: {
  allTitles: Title[]
  releases: Release[]
  kanalJeAdresse: Map<string, string | undefined>
  anisearch: Record<string, AnisearchEintrag>
  tmdbTitles: Record<string, TmdbTitelEintrag>
  mitStimmen: Set<number>
  verschoben: Title[]
  verweiseEntfernt: EntfernterVerweis[]
  titles: Map<number, Title>
  jpStartAnzeige: Map<number, string>
  events: ReleaseEvent[]
  meta: DataMeta
}) {
  const { trenneQuelle, synopses, annKennungen, trailer } = schreibeSynopsenUndReichereAn({
    allTitles,
    releases,
    kanalJeAdresse,
  })

  const { slim } = baueAuslieferung({
    allTitles,
    anisearch,
    tmdbTitles,
    trenneQuelle,
    synopses,
    mitStimmen,
    annKennungen,
    trailer,
    releases,
    verschoben,
    verweiseEntfernt,
  })

  schreibeListen({ slim, tmdbTitles, releases, titles })

  schreibeZusatzdateien({ titles, anisearch, slim, verschoben, releases, synopses, jpStartAnzeige })

  const { newsFuerRss } = schreibeKernUndNews({ releases, events, titles, meta })
  return { newsFuerRss }
}
