/**
 * Folgenliste mit Titeln je Cartoon — von TMDB, Staffel für Staffel.
 *
 * **Warum.** Netflix teilt „Avatar – Der Herr der Elemente" in drei Bücher (20/20/21), unser Cartoon ist eine Serie mit 61
 * Folgen; `fetch-cartoons.ts` übernimmt von TMDB nur `number_of_episodes`. Damit eine Meldung unabhängig von der Einteilung
 * des Anbieters über den Folgentitel an unsere Folge kommt (`lib/episodentitel-block.ts`), braucht jeder Cartoon mit
 * Netflix-/Prime-Verweis seine Titelliste.
 *
 * **Ablage** `data/cartoon-folgen.json`, Schlüssel = negative Cartoon-Kennung, Folgen flach wie in `tmdb-folgen.json`
 * (Staffel 0 = „Extras" bleibt getrennt erkennbar). `de` steht nur, wo er vom englischen Titel abweicht (TMDB fällt ohne
 * Übersetzung auf Englisch zurück). Eigene Datei, nicht `tmdb-folgen.json`: deren Leser (Nachrichten, Rohfolgen) rechnen mit
 * Anime-Kennungen.
 *
 * Warteschlange nach Alter (30 Tage), wie `fetch-tmdb-folgen.ts`.
 * Aufruf: `npx tsx pipeline/fetch-cartoon-folgen.ts [--limit N] [--alter TAGE]`
 */
import { loadEnv, fetchJson, log, readJson, sleep, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import type { Title } from '../shared/types.ts'
import type { CartoonFolge } from './lib/episodentitel-block.ts'
import { todayIso } from '../shared/time.ts'

const args = process.argv.slice(2)
const LIMIT = Number(args[args.indexOf('--limit') + 1]) || 400
const ALTER_TAGE = Number(args[args.indexOf('--alter') + 1]) || 30
const BASE = 'https://api.themoviedb.org/3'
/** Auf diesen Plattformen meldet die Erweiterung Folgen. */
const MELDEPLATTFORMEN = new Set(['netflix', 'primevideo'])

/** TMDB füllt fehlende deutsche Titel mit „Folge 7" auf — das ist keiner. */
const PLATZHALTER = /^(?:Folge|Episode)\s*\d+$/i

interface Eintrag {
  tmdbId: number
  geholtAm: string
  folgen: CartoonFolge[]
}

type TmdbStaffel = { episodes?: { episode_number: number; name?: string }[] }

async function staffel(id: number, nr: number, sprache: string, apiKey: string): Promise<Map<number, string>> {
  const j = await fetchJson<TmdbStaffel>(`${BASE}/tv/${id}/season/${nr}?api_key=${apiKey}&language=${sprache}`)
  await sleep(120)
  return new Map((j.episodes ?? []).flatMap((e) => (e.name?.trim() ? [[e.episode_number, e.name.trim()] as [number, string]] : [])))
}

/** Alle Folgen einer Serie, Staffel 0 eingeschlossen. */
async function holeFolgen(tmdbId: number, apiKey: string): Promise<CartoonFolge[]> {
  const serie = await fetchJson<{ seasons?: { season_number: number }[] }>(`${BASE}/tv/${tmdbId}?api_key=${apiKey}&language=de-DE`)
  const folgen: CartoonFolge[] = []
  for (const s of (serie.seasons ?? []).map((x) => x.season_number).sort((a, b) => a - b)) {
    const de = await staffel(tmdbId, s, 'de-DE', apiKey)
    const en = await staffel(tmdbId, s, 'en-US', apiKey)
    for (const e of [...new Set([...de.keys(), ...en.keys()])].sort((a, b) => a - b)) {
      const deTitel = PLATZHALTER.test(de.get(e) ?? '') ? undefined : de.get(e)
      const enTitel = en.get(e)
      folgen.push({ s, e, ...(enTitel ? { en: enTitel } : {}), ...(deTitel && deTitel !== enTitel ? { de: deTitel } : {}) })
    }
  }
  return folgen
}

async function main(): Promise<void> {
  loadEnv()
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) {
    warn('TMDB_API_KEY fehlt — ohne Schlüssel gibt TMDB keine Folgen heraus.')
    recordSource('cartoon-folgen', 0, 'kein Schlüssel')
    return
  }
  const cartoons = readJson<Title[]>('public/data/cartoons.json', [])
  const bestand = readJson<Record<string, Eintrag>>('data/cartoon-folgen.json', {})
  const grenze = Date.now() - ALTER_TAGE * 86_400_000
  const offen = cartoons
    .filter((t) => t.tmdbId && (t.episodes ?? 0) > 1 && (t.streams ?? []).some((s) => MELDEPLATTFORMEN.has(s.platform)))
    .filter((t) => !bestand[String(t.id)] || Date.parse(bestand[String(t.id)]!.geholtAm) < grenze)
    .slice(0, LIMIT)
  log(`${offen.length} Cartoons mit Folgenbedarf (Grenze ${ALTER_TAGE} Tage, höchstens ${LIMIT})`)

  let geholt = 0
  for (const t of offen) {
    try {
      const folgen = await holeFolgen(t.tmdbId!, apiKey)
      bestand[String(t.id)] = { tmdbId: t.tmdbId!, geholtAm: todayIso(), folgen }
      geholt++
      if (geholt % 20 === 0) writeJson('data/cartoon-folgen.json', bestand)
    } catch (err) {
      warn(`TMDB ${t.tmdbId} (${t.titleEn ?? t.id}): ${(err as Error).message}`)
    }
    await sleep(120)
  }
  writeJson('data/cartoon-folgen.json', bestand)
  log(`${geholt} Cartoons geholt; Bestand jetzt ${Object.keys(bestand).length}`)
  recordSource('cartoon-folgen', Object.keys(bestand).length, undefined, geholt)
}

await main()
