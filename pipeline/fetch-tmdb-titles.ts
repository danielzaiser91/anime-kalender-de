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
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Fsk, PlatformId, Title } from '../shared/types.ts'
import { ROOT, fetchJson, log, readJson, sleep, warn, writeJson } from './lib/util.ts'

/** .env einlesen, damit der Schlüssel nicht bei jedem Aufruf gesetzt werden muss. */
function loadEnv(): void {
  const envPath = resolve(ROOT, '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const args = process.argv.slice(2)
const FORCE = args.includes('--force')
const LIMIT = Number(args[args.indexOf('--limit') + 1]) || Infinity
const BASE = 'https://api.themoviedb.org/3'
const CACHE_PATH = 'data/tmdb-titles.json'

export interface TmdbTitle {
  tmdbId?: number
  kind?: 'tv' | 'movie'
  /** Deutsche Handlung, nur gesetzt bei sicherer Zuordnung. */
  overviewDe?: string
  fsk?: Fsk
  providers?: PlatformId[]
  /** Nichts gefunden — verhindert, dass jeder Lauf erneut sucht. */
  miss?: true
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
  const candidates = [title.titleEn, title.titleRomaji].filter(Boolean) as string[]
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
    const detail = await fetchJson<{ overview?: string }>(
      `${BASE}/${kind}/${best.hit.id}?api_key=${apiKey}&language=de-DE`,
    )
    // TMDB liefert bei fehlender Übersetzung ein leeres Feld statt Englisch.
    if (detail.overview && detail.overview.trim().length > 40) out.overviewDe = detail.overview.trim()
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
      results: Record<string, { flatrate?: { provider_name: string }[]; buy?: { provider_name: string }[] }>
    }>(`${BASE}/${kind}/${best.hit.id}/watch/providers?api_key=${apiKey}`)
    const de = wp.results?.DE
    if (de) {
      const names = [...(de.flatrate ?? []), ...(de.buy ?? [])].map((p) => p.provider_name)
      const platforms = [...new Set(names.map(providerToPlatform).filter(Boolean))] as PlatformId[]
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

  const todo = titles.filter((t) => FORCE || !cache[t.id]).slice(0, LIMIT)
  log(`TMDB: ${todo.length} von ${titles.length} Titeln offen`)

  let done = 0
  let withOverview = 0
  for (const title of todo) {
    cache[title.id] = await lookup(apiKey, title)
    if (cache[title.id].overviewDe) withOverview++
    done++
    if (done % 100 === 0) {
      log(`  ${done}/${todo.length} — ${withOverview} mit deutscher Handlung`)
      // Zwischenspeichern: Bei einem Abbruch ist die Arbeit sonst verloren.
      writeJson(CACHE_PATH, cache)
    }
  }

  writeJson(CACHE_PATH, cache)
  const total = Object.values(cache).filter((c) => c.overviewDe).length
  log(`Fertig: ${done} abgefragt, ${total} Titel mit deutscher Handlung im Bestand`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
