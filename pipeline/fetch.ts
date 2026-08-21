/**
 * Holt alle maschinell verfügbaren Rohdaten und legt sie in data/cache ab.
 *
 *   1. MyDubList  → welche MAL-IDs haben überhaupt eine deutsche Synchro
 *   2. AniList    → Metadaten zu genau diesen IDs
 *   3. AniList    → IDs für kuratierte Einträge auflösen (Ergebnis wird dauerhaft gemerkt)
 *   4. TMDB       → FSK und deutsche Anbieter, nur für kuratierte Titel (optional)
 *
 * Aufruf: npm run data:fetch  [-- --force] [-- --skip-anilist]
 */
import { mediaByMalIds, searchMedia, type AniListMedia } from './lib/anilist.ts'
import { loadCurated } from './lib/curated.ts'
import { lookupTmdb, type TmdbInfo } from './lib/tmdb.ts'
import { loadEnv, fetchJson, log, readJson, warn, writeJson } from './lib/util.ts'

const args = process.argv.slice(2)
const FORCE = args.includes('--force')
const SKIP_ANILIST = args.includes('--skip-anilist')

const MYDUBLIST_BASE =
  'https://raw.githubusercontent.com/Joelis57/MyDubList/main/dubs/confidence'

/** Liegt im Repo statt im Cache — sonst gehen die FSK-Angaben ohne API-Key verloren. */
const TMDB_PATH = 'data/tmdb.json'
const TIERS = ['low', 'normal', 'high', 'very-high'] as const
type Tier = (typeof TIERS)[number]

async function fetchDubList(): Promise<Record<number, Tier>> {
  const confidence: Record<number, Tier> = {}
  for (const tier of TIERS) {
    const data = await fetchJson<{ dubbed: number[] }>(`${MYDUBLIST_BASE}/${tier}/dubbed_german.json`)
    log(`MyDubList ${tier}: ${data.dubbed.length} Titel`)
    // Später gelesene Stufen sind die höheren — sie überschreiben bewusst.
    for (const id of data.dubbed) confidence[id] = tier
  }
  return confidence
}

async function main(): Promise<void> {
  loadEnv()

  // 1. Dub-Liste
  const confidence = await fetchDubList()
  const malIds = Object.keys(confidence).map(Number)
  writeJson('data/cache/dub-confidence.json', confidence)
  log(`Insgesamt ${malIds.length} MAL-IDs mit deutscher Synchro`)

  // 2. AniList-Metadaten
  const cached = readJson<Record<string, AniListMedia>>('data/cache/anilist-media.json', {})
  const missing = FORCE ? malIds : malIds.filter((id) => !cached[id])
  log(`AniList: ${missing.length} von ${malIds.length} IDs fehlen im Cache`)

  if (!SKIP_ANILIST && missing.length > 0) {
    const fetched = await mediaByMalIds(missing, (done, total) => {
      if (done % 500 === 0 || done === total) log(`  AniList ${done}/${total}`)
    })
    for (const [malId, media] of fetched) cached[String(malId)] = media
    writeJson('data/cache/anilist-media.json', cached)
    log(`AniList: ${fetched.size} neue Einträge, ${Object.keys(cached).length} im Cache`)
  }

  // 3. Kuratierte Einträge auflösen — Ergebnis bleibt im Repo, damit die Suche
  //    nicht bei jedem Lauf erneut läuft und Treffer stabil bleiben.
  const curated = loadCurated()
  const resolved = readJson<Record<string, number>>('data/curated-ids.json', {})
  let newResolutions = 0
  for (const entry of curated) {
    if (entry.anilistId) {
      resolved[entry.slug] = entry.anilistId
      continue
    }
    if (resolved[entry.slug] && !FORCE) continue
    if (!entry.search) {
      warn(`"${entry.slug}": weder anilistId noch search gesetzt`)
      continue
    }
    const hit = await searchMedia(entry.search)
    if (hit?.id) {
      resolved[entry.slug] = hit.id
      newResolutions++
      log(`  aufgelöst: ${entry.slug} → ${hit.id} (${hit.title.romaji ?? hit.title.english})`)
    } else {
      warn(`"${entry.slug}": keine AniList-Entsprechung für "${entry.search}"`)
    }
  }
  if (newResolutions > 0) writeJson('data/curated-ids.json', resolved, true)

  // AniList-Daten der kuratierten Titel nachladen, falls sie nicht über MAL kamen.
  const byAniId = readJson<Record<string, AniListMedia>>('data/cache/anilist-by-id.json', {})
  const neededIds = [...new Set(Object.values(resolved))].filter(
    (id) => FORCE || !byAniId[id],
  )
  if (!SKIP_ANILIST && neededIds.length > 0) {
    log(`AniList: ${neededIds.length} kuratierte Titel nachladen`)
    const { mediaById } = await import('./lib/anilist.ts')
    for (const id of neededIds) {
      const m = await mediaById(id)
      if (m) byAniId[String(id)] = m
    }
    writeJson('data/cache/anilist-by-id.json', byAniId)
  }

  // 4. TMDB — nur für kuratierte Titel, weil nur die im Kalender landen.
  const tmdbKey = process.env.TMDB_API_KEY
  if (!tmdbKey) {
    warn('TMDB_API_KEY nicht gesetzt — FSK und Anbieterliste werden übersprungen')
  } else {
    const tmdbCache = readJson<Record<string, TmdbInfo>>(TMDB_PATH, {})
    let done = 0
    for (const entry of curated) {
      if (!FORCE && tmdbCache[entry.slug]) continue
      const aniId = resolved[entry.slug]
      const media = aniId ? byAniId[String(aniId)] : undefined
      const query = media?.title.english ?? media?.title.romaji ?? entry.search ?? entry.titleDe ?? entry.slug
      const year = media?.startDate?.year ?? undefined
      const isMovie = media?.format === 'MOVIE'
      tmdbCache[entry.slug] = await lookupTmdb(tmdbKey, query, year, isMovie)
      done++
      if (done % 10 === 0) log(`  TMDB ${done} Titel abgefragt`)
    }
    writeJson(TMDB_PATH, tmdbCache, true)
    log(`TMDB: ${done} neue Abfragen, ${Object.keys(tmdbCache).length} im Cache`)
  }

  log('Fertig. Weiter mit: npm run data:build')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
