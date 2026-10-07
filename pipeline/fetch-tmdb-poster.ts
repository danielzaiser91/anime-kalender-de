/**
 * Das größte brauchbare Plakat je Titel — von TMDB.
 *
 * **Warum.** AniList liefert höchstens 460 × 644 Pixel (`large`), 551 Titel nur 230 px. Im vergrößerten Cover (Klick aufs Cover im
 * Panel) wirkte das auf einem Full-HD-Schirm unscharf (Daniel, 07.10.2026, „Rascal Does Not Dream of a Dear Friend"). TMDB führt
 * dasselbe Plakat in mehreren Größen (w500, w780, original bis 2000 × 3000) und meist mehrere Fassungen je Titel.
 *
 * **Auswahl.** Aus `/images` zählen nur Hochformate (Seitenverhältnis 0,64–0,76, wie das AniList-Cover). Bevorzugt wird die japanische
 * Fassung (gleiche Bildsprache wie AniList), dann ohne Schrift, dann deutsch, dann englisch; innerhalb einer Sprache das breiteste.
 * Gespeichert wird nur Pfad, Breite und Höhe — die Seite lädt die Größe, die sie braucht (`image.tmdb.org/t/p/<w500|w780>`).
 *
 * **Grenzen.** Die Zuordnung Titel → TMDB-Kennung kommt aus `data/tmdb-titles.json` (geprüft im Bau der Folgentitel). Wo sie fehlt oder das
 * größte Plakat unter `MIN_BREITE` liegt, bekommt der Titel keinen Eintrag; die Liste dazu schreibt der Bau (Monitor).
 *
 * Aufruf: `npx tsx pipeline/fetch-tmdb-poster.ts [--limit N] [--alle]`
 */
import { fetchJson, loadEnv, log, readJson, sleep, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import type { Title } from '../shared/types.ts'
import { passtFilm, waehlePlakat, type TmdbBild } from './lib/tmdb-plakat.ts'

const LIMIT = Number(process.argv[process.argv.indexOf('--limit') + 1]) || Infinity
const ALLE = process.argv.includes('--alle')

/**
 * **Filme ohne TMDB-Zuordnung** (Daniel, 07.10.2026, „Rascal Does Not Dream of a Dear Friend": der Kinofilm stand nicht in `tmdb-titles.json`).
 * Gesucht wird nach unseren Namen und dem Jahr; angenommen wird nur ein Treffer, dessen Name und Jahr passen (`passtFilm`) — sonst keiner.
 * Serien-Staffeln bleiben beim AniList-Cover, bis eine Zuordnung je Staffel besteht (`docs/wissen/quellen.md`).
 */
async function filmeSuchen(
  apiKey: string,
  zuordnung: Record<string, { tmdbId?: number }>,
  bestand: Record<string, { p: string; w: number; h: number; l: string | null } | null>,
): Promise<number> {
  const filme = readJson<Title[]>('public/data/titles.json', []).filter(
    (t) => t.format === 'MOVIE' && !zuordnung[String(t.id)]?.tmdbId && !(String(t.id) in bestand),
  )
  let gefunden = 0
  for (const t of filme) {
    try {
      let treffer: { id: number } | undefined
      for (const name of [t.titleEn, t.titleRomaji].filter((n): n is string => Boolean(n))) {
        const such = await fetchJson<{ results?: { id: number; title?: string; original_title?: string; release_date?: string }[] }>(
          `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(name)}&api_key=${apiKey}`,
        )
        treffer = (such.results ?? []).slice(0, 5).find((r) => passtFilm([t.titleEn, t.titleRomaji], t.jpYear, r))
        await sleep(120)
        if (treffer) break
      }
      const bilder = treffer ? await fetchJson<{ posters?: TmdbBild[] }>(`https://api.themoviedb.org/3/movie/${treffer.id}/images?include_image_language=ja,null,de,en&api_key=${apiKey}`) : undefined
      const wahl = bilder ? waehlePlakat(bilder.posters ?? []) : undefined
      bestand[String(t.id)] = wahl ? { p: wahl.file_path, w: wahl.width, h: wahl.height, l: wahl.iso_639_1 } : null
      if (wahl) gefunden++
    } catch (e) {
      warn(`TMDB-Film ${t.id}: ${(e as Error).message.slice(0, 80)}`)
    }
    await sleep(120)
  }
  log(`TMDB-Filme ohne Zuordnung: ${filme.length} gesucht, ${gefunden} mit Plakat`)
  return gefunden
}

async function main(): Promise<void> {
  loadEnv()
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) {
    warn('TMDB_API_KEY fehlt — ohne Schlüssel liefert TMDB keine Plakate.')
    recordSource('tmdb-poster', 0, 'kein Schlüssel')
    return
  }
  const zuordnung = readJson<Record<string, { tmdbId?: number; kind?: string }>>('data/tmdb-titles.json', {})
  const bestand = readJson<Record<string, { p: string; w: number; h: number; l: string | null } | null>>('data/tmdb-poster.json', {})
  const offen = Object.entries(zuordnung)
    .filter(([, z]) => z.tmdbId && (z.kind === 'tv' || z.kind === 'movie'))
    .filter(([id]) => ALLE || !(id in bestand))
    .slice(0, LIMIT)
  log(`TMDB-Plakate: ${offen.length} Titel abzufragen (${Object.keys(bestand).length} schon bekannt)`)
  let gefunden = 0
  let fehler = 0
  for (const [id, z] of offen) {
    try {
      const bilder = await fetchJson<{ posters?: TmdbBild[] }>(
        `https://api.themoviedb.org/3/${z.kind}/${z.tmdbId}/images?include_image_language=ja,null,de,en&api_key=${apiKey}`,
      )
      const wahl = waehlePlakat(bilder.posters ?? [])
      bestand[id] = wahl ? { p: wahl.file_path, w: wahl.width, h: wahl.height, l: wahl.iso_639_1 } : null
      if (wahl) gefunden++
    } catch (e) {
      /* Eine Kennung, die TMDB nicht mehr kennt, ist kein Ausfall: der Titel hat dort kein Plakat. */
      if ((e as Error).message.startsWith('404')) { bestand[id] = null; continue }
      fehler++
      warn(`TMDB-Plakat ${id}: ${(e as Error).message.slice(0, 80)}`)
      if (fehler > 20) break
    }
    await sleep(120)
    if (Object.keys(bestand).length % 200 === 0) writeJson('data/tmdb-poster.json', bestand)
  }
  gefunden += await filmeSuchen(apiKey, zuordnung, bestand)
  writeJson('data/tmdb-poster.json', bestand)
  log(`${gefunden} von ${offen.length} Titeln mit Plakat, ${fehler} Fehler`)
  recordSource('tmdb-poster', gefunden)
}

await main()
