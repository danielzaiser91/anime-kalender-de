/**
 * Holt für jeden Titel die deutschen Angaben von TMDB: Handlungsbeschreibung,
 * FSK-Freigabe und die in Deutschland verfügbaren Anbieter; bei Filmen auch die deutschen Kinostarts (`kinoDe`, `lib/tmdb-kino-zuletzt.ts`).
 *
 * Warum überhaupt: AniList führt Beschreibungen ausschließlich auf Englisch.
 * TMDB hat für viele Anime eine deutsche Übersetzung — die ist der einzige Weg
 * zu einer deutschen Handlung, ohne sie selbst zu schreiben.
 *
 * Die Zuordnung ist das Heikle daran. Ein falscher Treffer bringt die falsche
 * Handlung an den falschen Titel, und das fällt niemandem auf. Deshalb wird ein
 * Treffer nur übernommen, wenn Jahr **und** Titel zusammenpassen; im Zweifel
 * bleibt das Feld leer und die englische Fassung von AniList greift.
 *
 * Aufruf: npm run data:tmdb   [-- --force] [-- --limit 200]
 */
import type { Fsk, PlatformId, Title } from '../shared/types.ts'
import { loadEnv, log, readJson, warn, writeJson } from './lib/util.ts'
import type { TmdbOffer } from './lib/tmdb.ts'
import { recordSource } from './lib/health.ts'
import { findeGeteilteHauptserien, streicheZuordnungen } from './lib/tmdb-hauptserie.ts'
import { inhaltsStand, streicheAbgelaufenes, STREICH_TAGE } from './lib/tmdb-ablauf.ts'
import { lookup } from './lib/tmdb-titel-lookup.ts'
import { uebernimmVonHand } from './lib/tmdb-von-hand.ts'
import { kinoFehlt } from './lib/tmdb-kino-zuletzt.ts'
import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'

const args = process.argv.slice(2)
const FORCE = args.includes('--force')
const LIMIT = Number(args[args.indexOf('--limit') + 1]) || Infinity

/**
 * Wiedervorlage nach Alter, nicht nach „schon mal geholt".
 *
 * Bis zum 21.08.2026 bildete dieser Lauf seine Liste über `!cache[t.id]` — wer
 * einmal drin war, kam nie wieder dran. Das ist dieselbe Falle, die bei
 * aniSearch und Crunchyroll je einen Datenbestand eingefroren hat (siehe
 * `CLAUDE.md`, Abschnitt „Ein Abruf, der nur ergänzt, veraltet zwangsläufig"),
 * und sie wiegt hier doppelt: Ein `miss` verhinderte seine eigene Korrektur,
 * und die Anbieterliste je Titel blieb auf dem Stand ihres ersten Abrufs
 * stehen — obwohl Lizenzen auslaufen und Titel aus Angeboten verschwinden.
 *
 * 60 Tage, weil sich Handlung und FSK praktisch nie ändern und die Anbieter
 * selten. Bei 2.753 Titeln sind das rund 46 Abrufe am Tag; der Wochenlauf holt
 * sie mit `--limit 400` in einem Rutsch.
 */
const ALTER_TAGE = Number(args[args.indexOf('--alter') + 1]) || 60
const CACHE_PATH = 'data/tmdb-titles.json'

export interface TmdbTitle {
  tmdbId?: number
  kind?: 'tv' | 'movie'
  /** Deutsche Handlung, nur gesetzt bei sicherer Zuordnung. */
  overviewDe?: string
  /**
   * Der Name, mit dem TMDB auf `language=de-DE` antwortet.
   *
   * Gibt es keinen deutschen, steht dort der Originaltitel — der Bau entscheidet,
   * ob sich beide unterscheiden, denn nur er kennt beide.
   */
  nameDe?: string
  /**
   * Erscheinungsjahr laut TMDB — der Prüfstein gegen Gleichnamige.
   *
   * „Elysium" steht bei uns als koreanischer Mecha-Film von 2003; die
   * Prime-Suche führt auf den Hollywood-Film von 2013.
   * Titel und Typ stimmen dort überein, nur das Jahr nicht — und genau das
   * wurde bis zum 29.08.2026 nicht mitgespeichert. Ohne es kann kein Lauf
   * merken, dass der Treffer ein anderes Werk ist.
   */
  jahr?: number
  fsk?: Fsk
  providers?: PlatformId[]
  /** Alle deutschen Angebote, auch die ohne eigene Plattform. */
  offers?: TmdbOffer[]
  /** TMDBs Anbieterseite für die Region — dort stehen die Einzellinks. */
  justwatchUrl?: string
  /** Alle deutschen Kinostarts des Films (Typ 2/3, `JJJJ-MM-TT`); leer, wenn TMDB keinen führt. Nur Filme. */
  kinoDe?: string[]
  /** TMDB-Genres des Treffers (16 = Animation); ohne sie ist die Zuordnung ungeprüft (`fetch-tmdb-genre.ts`, `check-tmdb-genre.ts`). */
  genreIds?: number[]
  /** Nichts gefunden. Kein Dauerzustand: Nach `--alter` Tagen wird erneut gesucht. */
  miss?: true
  /** Wann dieser Eintrag zuletzt von TMDB geholt wurde (ISO-Datum). */
  fetchedAt?: string
  /** Wann der TMDB-Inhalt zuletzt von TMDB kam (`lib/tmdb-ablauf.ts`); ein Fehltreffer setzt nur `fetchedAt`. */
  inhaltAm?: string
}

/*
  **Ein Special erbt die Hauptserie nicht** (12.10.2026): Specials, OVAs und ONAs, deren Treffer eine TV-Serie unseres Bestands
  ist und weder im Namen noch in der Folgenzahl passt, verlieren die Kennung samt Handlung und Anbietern. Von Hand gesetzte bleiben.
*/
function speichereOhneGeteilteHauptserien(cache: Record<string, TmdbTitle>, titles: Title[], vonHand: Set<number>): void {
  const geteilt = findeGeteilteHauptserien({
    titles,
    cache,
    tmdbFolgen: readJson('data/tmdb-folgen.json', {}),
    vonHand,
  })
  streicheZuordnungen(cache, geteilt, new Date().toISOString())
  if (geteilt.length) log(`${geteilt.length} Special(s)/OVA(s)/ONA(s) ohne Hauptserien-Kennung: ${geteilt.join(', ')}`)
  writeJson(CACHE_PATH, cache)
}

/** Der Eintrag nach einem Abruf; ein Fehltreffer lässt den Inhalt stehen und trägt dessen echtes Alter (`inhaltAm`) mit. */
function nachAbruf(vorher: TmdbTitle | undefined, neu: TmdbTitle, jetzt: string): TmdbTitle {
  if (neu.miss && vorher?.tmdbId) return { ...vorher, inhaltAm: inhaltsStand(vorher), fetchedAt: jetzt }
  return { ...neu, inhaltAm: jetzt, fetchedAt: jetzt }
}

/** TMDB-API-Bedingungen: Inhalte höchstens 6 Monate behalten (`lib/tmdb-ablauf.ts`). */
function streicheAlteInhalte(cache: Record<string, TmdbTitle>): void {
  const gestrichen = streicheAbgelaufenes(cache, new Date())
  if (gestrichen.length) warn(`${gestrichen.length} Titel ohne TMDB-Inhalt: älter als ${STREICH_TAGE} Tage`)
}

async function main(): Promise<void> {
  loadEnv()
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) {
    warn('TMDB_API_KEY nicht gesetzt — Schritt übersprungen')
    return
  }

  const titles = readJson<Title[]>('public/data/titles.json', [])
  const cache = readJson<Record<string, TmdbTitle>>(CACHE_PATH, {})

  /*
    **Von Hand nachgesehene Kennungen gewinnen — und werden nie überschrieben.**

    Der Namensabgleich hat zwei blinde Flecken, beide am 23.09.2026 an den Dragon-Ball-Titeln
    gemessen: TMDB schreibt „Dragonball Z" in einem Wort (kein Treffer, also nie eine Kennung,
    also weder TMDB-Wege noch JustWatch-Abfrage), und ein Treffer **ohne Datum** kommt an der
    Jahresprüfung vorbei — so trug „Dragon Ball Super" (2015) die Kennung der für 2026
    angekündigten Beerus-Serie.

    Die Einträge stehen mit Grund und Prüfdatum in `data/tmdb-von-hand.yaml`.
  */
  const vonHand = yaml.load(readFileSync('data/tmdb-von-hand.yaml', 'utf8')) as
    | { anilistId: number; tmdbId: number; kind?: 'tv' | 'movie' }[]
    | null
  const gesetzt = uebernimmVonHand(cache, vonHand ?? [], new Date().toISOString())
  if (gesetzt) {
    writeJson(CACHE_PATH, cache)
    log(`${gesetzt} Kennung(en) aus data/tmdb-von-hand.yaml gesetzt`)
  }
  const handIds = new Set((vonHand ?? []).map((e) => e.anilistId))

  /**
   * Ältestes zuerst — und was noch nie geholt wurde, ganz nach vorn.
   *
   * Ein Eintrag ohne `fetchedAt` stammt aus der Zeit vor dieser Änderung; sein
   * Alter ist unbekannt und damit im Zweifel groß.
   */
  const grenze = new Date(Date.now() - ALTER_TAGE * 86400_000).toISOString()
  const faellig = titles
    /*
      **Ein Fehlschlag wird früher wiedervorgelegt als ein Treffer.**

      Wer gefunden wurde, ändert sich selten; wer nicht gefunden wurde, kann beim
      nächsten Mal mit einer anderen Schreibweise treffen — genau das ist am
      28.08.2026 passiert, als der japanische und der deutsche Titel dazukamen.
      Ohne diese Ausnahme hätten die 1.247 Fehlschläge bis zum Ablauf der vollen
      Frist auf ihren zweiten Versuch gewartet.
    */
    .filter((t) => {
      /* Was von Hand steht, wird nicht neu gesucht — sonst gewinnt der Fehltreffer wieder. */
      if (handIds.has(t.id)) return false
      if (FORCE || !cache[t.id] || kinoFehlt(cache[t.id]!)) return true
      const e = cache[t.id]!
      const frist = e.tmdbId ? grenze : new Date(Date.now() - 7 * 86400_000).toISOString()
      return (e.fetchedAt ?? '') < frist
    })
    .sort((a, b) => (cache[a.id]?.fetchedAt ?? '').localeCompare(cache[b.id]?.fetchedAt ?? ''))
  const todo = faellig.slice(0, LIMIT)
  const nie = faellig.filter((t) => !cache[t.id]).length
  log(
    `TMDB: ${faellig.length} von ${titles.length} Titeln fällig ` +
      `(${nie} noch nie geholt, Rest älter als ${ALTER_TAGE} Tage), ${todo.length} in diesem Lauf`,
  )
  let done = 0
  let withOverview = 0
  for (const title of todo) {
    const neu = await lookup(apiKey, title)
    const vorher = cache[title.id]
    /*
      **Ein Fehltreffer löscht keine gefundene Zuordnung** (17.09.2026). An `tmdbId`
      hängen JustWatch, die Streaming-Availability-Daten und die Trailer; eine TMDB-Störung
      oder ein geänderter Titel nahm ihnen bis dahin den Schlüssel.
    */
    cache[title.id] = nachAbruf(vorher, neu, new Date().toISOString())
    if (cache[title.id].overviewDe) withOverview++
    done++
    if (done % 100 === 0) {
      log(`  ${done}/${todo.length} — ${withOverview} mit deutscher Handlung`)
      // Zwischenspeichern: Bei einem Abbruch ist die Arbeit sonst verloren.
      writeJson(CACHE_PATH, cache)
    }
  }

  streicheAlteInhalte(cache)
  speichereOhneGeteilteHauptserien(cache, titles, handIds)
  recordSource('tmdb-titles', done)
  const total = Object.values(cache).filter((c) => c.overviewDe).length
  log(`Fertig: ${done} abgefragt, ${total} Titel mit deutscher Handlung im Bestand`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
