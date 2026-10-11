/**
 * Das Hintergrundbild je Titel — von TMDB (Daniel, 11.10.2026: Banner von TMDB statt AniList).
 *
 * Die Zuordnung Titel → TMDB-Kennung kommt aus `data/tmdb-titles.json`. Aus `/images` zählt nur ein Querformat ab 1.280 px
 * (`lib/tmdb-banner.ts`). Wo es keins gibt, steht `null`; der Titel kommt auf die Lückenliste (`lib/banner-luecken.ts`).
 *
 * Aufruf: `npx tsx pipeline/fetch-tmdb-banner.ts [--limit N] [--alle]`
 */
import { fetchJson, loadEnv, log, readJson, sleep, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import type { TmdbBild } from './lib/tmdb-plakat.ts'
import { BANNER_DATEI, waehleBanner, type TmdbBanner } from './lib/tmdb-banner.ts'
import { schreibeBannerLuecken } from './lib/banner-luecken.ts'

const LIMIT = Number(process.argv[process.argv.indexOf('--limit') + 1]) || Infinity
const ALLE = process.argv.includes('--alle')

type Zuordnung = Record<string, { tmdbId?: number; kind?: string }>

async function main(): Promise<void> {
  loadEnv()
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) {
    warn('TMDB_API_KEY fehlt — ohne Schlüssel liefert TMDB keine Hintergrundbilder.')
    recordSource('tmdb-banner', 0, 'kein Schlüssel')
    return
  }
  const zuordnung = readJson<Zuordnung>('data/tmdb-titles.json', {})
  const bestand = readJson<TmdbBanner>(BANNER_DATEI, {})
  const offen = Object.entries(zuordnung)
    .filter(([, z]) => z.tmdbId && (z.kind === 'tv' || z.kind === 'movie'))
    .filter(([id]) => ALLE || !(id in bestand))
    .slice(0, LIMIT)
  log(`TMDB-Banner: ${offen.length} Titel abzufragen (${Object.keys(bestand).length} schon bekannt)`)
  let gefunden = 0
  let fehler = 0
  for (const [id, z] of offen) {
    try {
      const bilder = await fetchJson<{ backdrops?: TmdbBild[] }>(
        `https://api.themoviedb.org/3/${z.kind}/${z.tmdbId}/images?include_image_language=ja,null,de,en&api_key=${apiKey}`,
      )
      const wahl = waehleBanner(bilder.backdrops ?? [])
      bestand[id] = wahl ? { p: wahl.file_path, w: wahl.width, h: wahl.height } : null
      if (wahl) gefunden++
    } catch (e) {
      /* Eine Kennung, die TMDB nicht mehr kennt, ist kein Ausfall: der Titel hat dort kein Bild. */
      if ((e as Error).message.startsWith('404')) { bestand[id] = null; continue }
      fehler++
      warn(`TMDB-Banner ${id}: ${(e as Error).message.slice(0, 80)}`)
      if (fehler > 20) break
    }
    await sleep(120)
    if (Object.keys(bestand).length % 200 === 0) writeJson(BANNER_DATEI, bestand)
  }
  writeJson(BANNER_DATEI, bestand)
  schreibeBannerLuecken(bestand, zuordnung)
  log(`${gefunden} von ${offen.length} Titeln mit Hintergrundbild, ${fehler} Fehler`)
  recordSource('tmdb-banner', gefunden)
}

await main()
