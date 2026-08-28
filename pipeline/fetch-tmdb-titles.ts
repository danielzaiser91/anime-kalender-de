/**
 * Holt für jeden Titel die deutschen Angaben von TMDB: Handlungsbeschreibung,
 * FSK-Freigabe und die in Deutschland verfügbaren Anbieter.
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
import { loadEnv, fetchJson, log, readJson, sleep, warn, writeJson } from './lib/util.ts'
import { readOffers, type TmdbOffer } from './lib/tmdb.ts'
import { recordSource } from './lib/health.ts'

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
const BASE = 'https://api.themoviedb.org/3'
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
  fsk?: Fsk
  providers?: PlatformId[]
  /** Alle deutschen Angebote, auch die ohne eigene Plattform. */
  offers?: TmdbOffer[]
  /** TMDBs Anbieterseite für die Region — dort stehen die Einzellinks. */
  justwatchUrl?: string
  /** Nichts gefunden. Kein Dauerzustand: Nach `--alter` Tagen wird erneut gesucht. */
  miss?: true
  /** Wann dieser Eintrag zuletzt von TMDB geholt wurde (ISO-Datum). */
  fetchedAt?: string
}

const FSK_VALUES: Fsk[] = [0, 6, 12, 16, 18]

function parseFsk(raw: string | undefined): Fsk | undefined {
  if (!raw) return undefined
  const n = Number(raw.replace(/[^\d]/g, ''))
  return FSK_VALUES.includes(n as Fsk) ? (n as Fsk) : undefined
}

function providerToPlatform(name: string): PlatformId | undefined {
  const n = name.toLowerCase()
  if (n.includes('crunchyroll')) return 'crunchyroll'
  if (n.includes('netflix')) return 'netflix'
  if (n.includes('disney')) return 'disneyplus'
  if (n.includes('amazon') || n.includes('prime video')) return 'primevideo'
  if (n.includes('animation digital network') || n === 'adn') return 'adn'
  if (n.includes('wow')) return 'wow'
  if (n.includes('joyn')) return 'joyn'
  if (n.includes('rtl')) return 'rtlplus'
  if (n.includes('aniverse')) return 'aniverse'
  return undefined
}

/** Vergleichsform: Kleinschreibung, ohne Satzzeichen, ohne Füllwörter. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[:!?,.'"„“”–—_-]/g, ' ')
    .replace(/\b(the|a|an|der|die|das|season|staffel|part|cour)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Ähnlichkeit über gemeinsame Wörter. Reicht hier: Es geht nur darum, einen
 * offensichtlich falschen Treffer zu erkennen, nicht um Feinabstufungen.
 */
function similarity(a: string, b: string): number {
  const wordsA = new Set(normalize(a).split(' ').filter((w) => w.length > 2))
  const wordsB = new Set(normalize(b).split(' ').filter((w) => w.length > 2))
  if (!wordsA.size || !wordsB.size) return 0
  let shared = 0
  for (const word of wordsA) if (wordsB.has(word)) shared++
  return shared / Math.min(wordsA.size, wordsB.size)
}

interface SearchHit {
  id: number
  name?: string
  title?: string
  original_name?: string
  original_title?: string
  first_air_date?: string
  release_date?: string
}

async function lookup(apiKey: string, title: Title): Promise<TmdbTitle> {
  const isMovie = title.format === 'MOVIE'
  const kind = isMovie ? 'movie' : 'tv'
  /*
    **Vier Schreibweisen statt zwei.**

    Am 28.08.2026 gemessen: 1.247 von 2.753 Titeln findet TMDB nicht, darunter
    392 Serien, für die wir einen Verweis führen. Gesucht wurde bis dahin nur
    mit dem englischen und dem Romaji-Titel.

    TMDB führt zu jedem Eintrag auch `original_name` — bei Anime ist das der
    **japanische** Titel, und den haben wir als `titleNative`. Der deutsche
    Titel kommt dazu, weil TMDB deutsche Ausgaben unter ihrem hiesigen Namen
    kennt („Die Rückkehr der Zauberer" findet man nicht als „Mahoutsukai").

    Die Reihenfolge bleibt: Was zuerst trifft, gewinnt, und Englisch ist die
    Schreibweise, unter der TMDB Anime am ehesten führt.
  */
  const candidates = [title.titleEn, title.titleRomaji, title.titleDe, title.titleNative].filter(
    Boolean,
  ) as string[]
  if (!candidates.length) return { miss: true }

  let best: { hit: SearchHit; score: number } | undefined

  for (const query of candidates) {
    const url =
      `${BASE}/search/${kind}?api_key=${apiKey}&language=de-DE&include_adult=false` +
      `&query=${encodeURIComponent(query)}`
    let results: SearchHit[]
    try {
      results = (await fetchJson<{ results: SearchHit[] }>(url)).results ?? []
    } catch (err) {
      warn(`Suche fehlgeschlagen für "${query}": ${(err as Error).message}`)
      continue
    }
    await sleep(40)

    for (const hit of results.slice(0, 5)) {
      const hitYear = Number((hit.first_air_date ?? hit.release_date ?? '').slice(0, 4))
      // Jahr muss passen — dieselbe Serie in einem anderen Jahr ist eine andere Staffel.
      if (title.jpYear && hitYear && Math.abs(hitYear - title.jpYear) > 1) continue
      const names = [hit.name, hit.title, hit.original_name, hit.original_title].filter(Boolean) as string[]
      const score = Math.max(...names.map((n) => similarity(query, n)), 0)
      if (score >= 0.6 && (!best || score > best.score)) best = { hit, score }
    }
    if (best && best.score >= 0.85) break
  }

  if (!best) return { miss: true }

  const out: TmdbTitle = { tmdbId: best.hit.id, kind }

  try {
    const detail = await fetchJson<{ overview?: string; name?: string; title?: string }>(
      `${BASE}/${kind}/${best.hit.id}?api_key=${apiKey}&language=de-DE`,
    )
    // TMDB liefert bei fehlender Übersetzung ein leeres Feld statt Englisch.
    if (detail.overview && detail.overview.trim().length > 40) out.overviewDe = detail.overview.trim()
    /*
      **Der deutsche Titel kommt aus derselben Antwort — er wurde nur nie gelesen.**

      194 Titel im Bestand haben keinen deutschen Namen; `titleDe` kommt bisher
      allein aus aniSearch. TMDB antwortet auf `language=de-DE` mit dem deutschen
      Namen, wenn es einen gibt, und sonst mit dem Originaltitel.

      Genau deshalb wird er hier nur mitgeschrieben, nicht gesetzt: Ob er sich
      vom Originaltitel unterscheidet, entscheidet der Bau — er kennt beide.
    */
    const nameDe = (detail.name ?? detail.title ?? "").trim()
    if (nameDe) out.nameDe = nameDe
    await sleep(40)

    if (isMovie) {
      const rel = await fetchJson<{
        results: { iso_3166_1: string; release_dates: { certification: string }[] }[]
      }>(`${BASE}/movie/${best.hit.id}/release_dates?api_key=${apiKey}`)
      const de = rel.results?.find((r) => r.iso_3166_1 === 'DE')
      out.fsk = parseFsk(de?.release_dates?.find((r) => r.certification)?.certification)
    } else {
      const ratings = await fetchJson<{ results: { iso_3166_1: string; rating: string }[] }>(
        `${BASE}/tv/${best.hit.id}/content_ratings?api_key=${apiKey}`,
      )
      out.fsk = parseFsk(ratings.results?.find((r) => r.iso_3166_1 === 'DE')?.rating)
    }
    await sleep(40)

    const wp = await fetchJson<{
      results: Record<
        string,
        {
          link?: string
          flatrate?: { provider_name: string }[]
          rent?: { provider_name: string }[]
          buy?: { provider_name: string }[]
        }
      >
    }>(`${BASE}/${kind}/${best.hit.id}/watch/providers?api_key=${apiKey}`)
    const de = wp.results?.DE
    if (de) {
      out.justwatchUrl = de.link
      // Die ganze Liste behalten, nicht nur die Dienste mit eigener Plattform.
      const offers = readOffers(de)
      if (offers.length) out.offers = offers
      const platforms = [
        ...new Set(offers.map((o) => providerToPlatform(o.name)).filter(Boolean)),
      ] as PlatformId[]
      if (platforms.length) out.providers = platforms
    }
    await sleep(40)
  } catch (err) {
    warn(`Details fehlgeschlagen für TMDB ${best.hit.id}: ${(err as Error).message}`)
  }

  return out
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
      if (FORCE || !cache[t.id]) return true
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
    cache[title.id] = { ...(await lookup(apiKey, title)), fetchedAt: new Date().toISOString() }
    if (cache[title.id].overviewDe) withOverview++
    done++
    if (done % 100 === 0) {
      log(`  ${done}/${todo.length} — ${withOverview} mit deutscher Handlung`)
      // Zwischenspeichern: Bei einem Abbruch ist die Arbeit sonst verloren.
      writeJson(CACHE_PATH, cache)
    }
  }

  writeJson(CACHE_PATH, cache)
  recordSource('tmdb-titles', done)
  const total = Object.values(cache).filter((c) => c.overviewDe).length
  log(`Fertig: ${done} abgefragt, ${total} Titel mit deutscher Handlung im Bestand`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
