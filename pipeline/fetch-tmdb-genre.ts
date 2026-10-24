/**
 * Liest zu jeder TMDB-Zuordnung das Genre und entfernt Zuordnungen ohne Animation (Realserie „Kakegurui" statt des Anime, 21.10.2026).
 * `npm run data:tmdb-genre` fährt danach `fetch-tmdb-titles.ts` (sucht die entfernten Titel neu, mit Genre-Prüfung); Poster, Banner und Folgen holen ihre fehlenden Einträge in ihren Läufen.
 * Aufruf: npm run data:tmdb-genre
 */
import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { fetchJson, loadEnv, log, readJson, sleep, warn, writeJson } from './lib/util.ts'
import { genreNachtragen } from './lib/tmdb-genre-lauf.ts'

const BASE = 'https://api.themoviedb.org/3'
const ABGELEITET = ['data/tmdb-poster.json', 'data/tmdb-poster-grund.json', 'data/tmdb-banner.json', 'data/tmdb-folgen.json', 'data/tmdb-staffel0.json']

async function main(): Promise<void> {
  loadEnv()
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) return warn('TMDB_API_KEY nicht gesetzt — Schritt übersprungen')
  const cache = readJson<Record<string, { tmdbId?: number; kind?: string; genreIds?: number[] }>>('data/tmdb-titles.json', {})
  const hand = (yaml.load(readFileSync('data/tmdb-von-hand.yaml', 'utf8')) as { anilistId: number }[] | null) ?? []
  const tabellen = ABGELEITET.map((p) => readJson<Record<string, object>>(p, {}))
  const hole = async (kind: string, id: number): Promise<{ genreIds: number[]; info: string } | undefined> => {
    try {
      const d = await fetchJson<{ genres?: { id: number }[]; name?: string; title?: string; original_name?: string; original_title?: string; original_language?: string; origin_country?: string[]; first_air_date?: string; release_date?: string }>(`${BASE}/${kind}/${id}?api_key=${apiKey}`)
      await sleep(40)
      const ids = (d.genres ?? []).map((g) => g.id)
      const info = `${kind}/${id} ${d.original_name ?? d.original_title} / ${d.name ?? d.title}, ${d.original_language} ${(d.origin_country ?? []).join()}, ${d.first_air_date ?? d.release_date}, Genres ${ids.join()}`
      return { genreIds: ids, info }
    } catch (err) {
      warn(`${kind}/${id}: ${(err as Error).message}`)
      return undefined
    }
  }
  const r = await genreNachtragen(cache, new Set(hand.map((e) => e.anilistId)), tabellen, hole)
  writeJson('data/tmdb-titles.json', cache)
  ABGELEITET.forEach((p, i) => writeJson(p, tabellen[i]))
  log(`Genre: ${r.gemessen} gelesen, ${r.unbeantwortet} ohne Antwort, ${r.entfernt.length} ohne Animation entfernt: ${r.entfernt.join(', ')}`)
  for (const i of r.infos) log(`  entfernt ${i}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
