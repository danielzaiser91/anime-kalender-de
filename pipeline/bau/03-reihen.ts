import { PLATFORM_PRIORITY } from '../../shared/mappings.ts'
import { ladeTitelDe } from '../lib/titel-de.ts'
import { loadDubChecks } from '../lib/dub-confirmed.ts'
import { type Title } from '../../shared/types.ts'
import { type AniListMedia } from '../lib/anilist.ts'
import { type AnisearchEintrag, type TmdbTitelEintrag } from './01-quellen.ts'
import { bildeReihen } from './03-1-reihen-bilden.ts'
import { uebernehmeAnisearchUndDeutscheTitel } from './03-3-anisearch-und-titel.ts'
import { uebernehmeTmdbAngebote } from './03-4-tmdb-angebote.ts'
import { ergaenzeWegeVonHand } from './03-5-wege-von-hand.ts'

export function fuehreReihenZusammen({ byAniId, byMal, titles, tmdbTitles, anisearch }: {
  byAniId: Record<string, AniListMedia>
  byMal: Record<string, AniListMedia>
  titles: Map<number, Title>
  tmdbTitles: Record<string, TmdbTitelEintrag>
  anisearch: Record<string, AnisearchEintrag>
}) {
  bildeReihen({ byAniId, byMal, titles })

  // FSK aus TMDB für alle Titel übernehmen, nicht nur für kuratierte.
  /*
    **Ein `available: false` gilt auch für einen Kaufweg.**

    Bisher wirkte es nur auf `streams` — die `watchLinks` aus aniSearch liefen
    daran vorbei. Bei „Nicht schon wieder, Takagi-san" stand deshalb
    „Crunchyroll über Prime Video" im Panel, und die Adresse antwortete mit
    Amazons Fehlerseite: „Die eingegebene Webadresse ist keine funktionsfähige
    Seite" (Daniel, 04.09.2026, mit Bild). Sie stammt aus aniSearch und ist dort
    veraltet.

    Ein Weg, der ins Leere führt, ist schlechter als kein Weg: Er sieht aus wie
    eine Antwort und kostet einen Klick, um sich als keine zu erweisen.
  */
  /** Von Hand geprüfte deutsche Werktitel, siehe unten bei `deutscheTitelHand`. */
  const handTitel = ladeTitelDe()

  const toteAdressen = new Set(
    loadDubChecks()
      .filter((c) => c.available === false && c.url)
      .map((c) => c.url!),
  )
  for (const title of titles.values()) {
    const extra = tmdbTitles[title.id]
    if (extra?.fsk !== undefined && title.fsk === undefined) title.fsk = extra.fsk
  }

  const { netflixOhneKennung } = uebernehmeAnisearchUndDeutscheTitel({ handTitel, titles, anisearch, tmdbTitles, toteAdressen })

  const { tvJeTmdb } = uebernehmeTmdbAngebote({ titles, tmdbTitles, toteAdressen })

  // Von Hand gepflegte Bezugswege. Sie stehen vorn: Wer sie einträgt, hat
  // nachgesehen — das schlägt jede automatische Liste.
  ergaenzeWegeVonHand({ titles })

  for (const title of titles.values()) {
    title.streams.sort(
      (a, b) => PLATFORM_PRIORITY.indexOf(a.platform) - PLATFORM_PRIORITY.indexOf(b.platform),
    )
  }
  return { tvJeTmdb, toteAdressen, netflixOhneKennung }
}
