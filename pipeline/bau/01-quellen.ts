import { readJson, log } from '../lib/util.ts'
import { type DubConfidence, type Fsk, type PlatformId } from '../../shared/types.ts'
import { type AniListMedia } from '../lib/anilist.ts'
import { type TmdbInfo } from '../lib/tmdb.ts'
import { mehrdeutigeFilmzuordnungen } from '../lib/tmdb-eindeutig.ts'
import { loadCurated } from '../lib/curated.ts'

/** Je AniList-ID: deutsche Handlung, FSK und Anbieter aus TMDB (`data/tmdb-titles.json`). */
export type TmdbTitelEintrag = {
  overviewDe?: string
  nameDe?: string
  fsk?: Fsk
  providers?: PlatformId[]
  offers?: { name: string; kind: 'flatrate' | 'rent' | 'buy' }[]
  justwatchUrl?: string
  /** Kennung und Art bei TMDB — nötig, um die Quelle verlinken zu können. */
  tmdbId?: number
  kind?: 'tv' | 'movie'
}

/** Je AniList-ID: deutsche Inhaltsangabe, Anbieter und Sprachblöcke aus aniSearch (`data/anisearch.json`). */
export type AnisearchEintrag = {
  descriptionDe?: string
  /* Die Kennung bei aniSearch — sie wird an den Titel ausgeliefert, damit
     die Quellenuebersicht dorthin verlinken kann. */
  anisearchId?: number
  streams: { provider: string; url: string }[]
  info?: {
    episodes?: number
    episodesEstimated?: boolean
    /** Der Titel je Sprache — hier steht der deutsche Name des Werks. */
    /* `publisher` und `status` tragen den Bezugsweg aus dem deutschen Block — siehe unten. */
    languages?: { language?: string; title?: string; status?: string; released?: string; publisher?: string[] }[]
    /** Weitere Namen, ohne Sprachkennzeichen — für die Suche (`synonyme.json`). */
    synonyms?: string[]
  }
}

export function ladeQuellen() {
  const confidenceRaw = readJson<Record<string, DubConfidence>>('data/cache/dub-confidence.json', {})
  const byMal = readJson<Record<string, AniListMedia>>('data/cache/anilist-media.json', {})
  const byAniId = readJson<Record<string, AniListMedia>>('data/cache/anilist-by-id.json', {})
  const curatedIds = readJson<Record<string, number>>('data/curated-ids.json', {})
  // Liegt bewusst im Repo statt im Cache: ohne TMDB-Key soll ein Build die
  // bereits ermittelten FSK-Angaben nicht wieder verlieren.
  const tmdb = readJson<Record<string, TmdbInfo>>('data/tmdb.json', {})
  // Je AniList-ID: deutsche Handlung, FSK und Anbieter — für alle Titel, nicht
  // nur die kuratierten.
  const tmdbTitles = readJson<Record<string, TmdbTitelEintrag>>('data/tmdb-titles.json', {})
  /* Mehrfach vergebene Filme verlieren ihre TMDB-Angaben — siehe `mehrdeutigeFilmzuordnungen()`. */
  const tmdbMehrdeutig = mehrdeutigeFilmzuordnungen(tmdbTitles)
  for (const id of tmdbMehrdeutig) delete tmdbTitles[id]
  if (tmdbMehrdeutig.size)
    log(`${tmdbMehrdeutig.size} TMDB-Zuordnungen verworfen: derselbe Film stand bei mehreren Titeln`)
  // Deutsche Inhaltsangaben und Anbieter von aniSearch. Fehlt die Datei, läuft
  // alles wie zuvor — nur eben mit den schwächeren Texten.
  const anisearch = readJson<Record<string, AnisearchEintrag>>('data/anisearch.json', {})
  const curated = loadCurated()

  /**
   * Die Folgenzahl laut aniSearch — samt deren eigener Einschätzung, ob sie
   * schon feststeht.
   *
   * Die bisherige Rückfallregel war „zwölf, weil das die übliche Cour-Länge
   * ist". Das ist geraten, und bei einer 24-teiligen Reihe fehlte der Kalender
   * ab Folge 13 einfach. aniSearch pflegt die Zahl redaktionell und schreibt
   * dazu, wenn sie vorläufig ist — beides übernehmen wir: die Zahl als
   * besseren Wert, die Kennzeichnung, damit aus fremder Unsicherheit keine
   * eigene Behauptung wird.
   *
   * Eine Jahresprüfung wie bei AniList braucht es hier nicht: Die Zuordnung
   * kommt aus der ID-Brücke und trifft damit genau diese Staffel.
   */
  const anisearchEpisodes = (
    titleId: number | undefined,
  ): { count: number; estimated: boolean } | undefined => {
    const info = titleId === undefined ? undefined : anisearch[titleId]?.info
    if (!info?.episodes || info.episodes < 1) return undefined
    return { count: info.episodes, estimated: info.episodesEstimated === true }
  }

  // Notbremse: Ohne den AniList-Cache baut dieser Lauf einen Datensatz ohne
  // einen einzigen Titel — und damit ohne Genres, Keywords, Cover und
  // Beschreibungen. Das sieht in der Ausgabe harmlos aus („Titel: 0") und
  // überschreibt trotzdem alles unter public/data/.
  //
  // Genau das ist am 08.08.2026 passiert: Der stündliche Workflow rief
  // `data:build` ohne vorheriges `data:fetch` auf, und `data/cache/` liegt
  // bewusst nicht im Repo. Der Kalender stand danach eine Stunde lang ohne
  // Genre- und Keyword-Filter da.
  if (!Object.keys(byMal).length && !Object.keys(byAniId).length) {
    console.error(
      'Abbruch: data/cache/ ist leer — ohne AniList-Daten gäbe es keinen einzigen Titel.\n' +
        'Erst `npm run data:fetch` laufen lassen. Der bestehende Datensatz bleibt unangetastet.',
    )
    process.exit(1)
  }
  return { byMal, confidenceRaw, byAniId, tmdbTitles, anisearch, curated, curatedIds, tmdb, anisearchEpisodes, tmdbMehrdeutig }
}
