/**
 * Eine TMDB-Kennung, auf die der Serien-Abruf mit 404 antwortete (`data/tmdb-folgen-404.json`), wird nicht geparkt, sondern neu gesucht:
 * Reine Regel (`neusucheFaellig`, `faelligeTitel`) und der echte Lauf von `fetch-tmdb-titles.ts` gegen eine Kulisse (`AK_ROOT`, Attrappe-`fetch`).
 * Treffer ersetzt die tote Kennung; ohne Treffer bleibt Eintrag samt Vermerk stehen; wer schon neu gesucht wurde oder einen Vermerk zu
 * anderer Kennung hat, bleibt byte-gleich. Aufruf: `npm run check:logic`.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { faelligeTitel } from './lib/tmdb-faellig.ts'
import { neusucheFaellig } from './lib/tmdb-folgen-404.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

console.log('\nTMDB 404 Neusuche: Regel')
const v = { tmdbId: 5, geprueft: '2026-10-26' }
const e = (tmdbId: number | undefined, fetchedAt: string | undefined): { tmdbId?: number; fetchedAt?: string } => ({ tmdbId, fetchedAt })
pruefe('Suche vor dem Vermerktag: fällig', neusucheFaellig(v, e(5, '2026-10-20T05:00:00.000Z')))
pruefe('Suche am Vermerktag: fällig (Reihenfolge am Tag unbekannt)', neusucheFaellig(v, e(5, '2026-10-26T05:00:00.000Z')))
pruefe('Suche nach dem Vermerktag: erledigt', !neusucheFaellig(v, e(5, '2026-10-27T00:00:00.000Z')))
pruefe('Eintrag ohne Datum: fällig', neusucheFaellig(v, e(5, undefined)))
pruefe('Vermerk einer anderen Kennung: nicht fällig', !neusucheFaellig(v, e(6, '2026-10-20T05:00:00.000Z')))
pruefe('Eintrag ohne Kennung: nicht fällig', !neusucheFaellig(v, e(undefined, '2026-10-20T05:00:00.000Z')))
pruefe('ohne Vermerk: nicht fällig', !neusucheFaellig(undefined, e(5, '2026-10-20T05:00:00.000Z')))
pruefe('ohne Eintrag: nicht fällig', !neusucheFaellig(v, undefined))

const titel = [{ id: 1 }, { id: 2 }]
const cache = { 1: { tmdbId: 5, kind: 'tv', genreIds: [16], fetchedAt: '2999-01-01T00:00:00.000Z' }, 2: { tmdbId: 7, kind: 'tv', genreIds: [16], fetchedAt: '2999-01-01T00:00:00.000Z' } }
const wahl = (tot: Record<string, { tmdbId: number; geprueft: string }> | undefined): string =>
  faelligeTitel(titel, cache, { handIds: new Set(), nurOhneEintrag: false, force: false, grenze: '2000', grenzeFehlschlag: '2000', tot }).map((t) => t.id).join(',')
pruefe('Auswahl: Titel mit totem Vermerk ist trotz frischem Abruf dran', wahl({ 1: { tmdbId: 5, geprueft: '2999-01-02' } }) === '1', wahl({ 1: { tmdbId: 5, geprueft: '2999-01-02' } }))
pruefe('Auswahl: ohne Vermerke ist niemand dran', wahl(undefined) === '')
pruefe('Auswahl: Vermerk eines anderen Titels trifft nur diesen', wahl({ 2: { tmdbId: 7, geprueft: '2999-01-02' } }) === '2')
const alt = { 1: cache[1], 2: { ...cache[2], fetchedAt: '2000-01-01T00:00:00.000Z' } }
const reihenfolge = faelligeTitel(titel, alt, { handIds: new Set(), nurOhneEintrag: false, force: false, grenze: '2500', grenzeFehlschlag: '2500', tot: { 1: { tmdbId: 5, geprueft: '2999-01-02' } } }).map((t) => t.id).join(',')
pruefe('Reihenfolge: tote Kennung vor dem älteren Abruf', reihenfolge === '1,2', reihenfolge)

console.log('\nTMDB 404 Neusuche: Prozess fetch-tmdb-titles.ts')
const KULISSE = `
const hit = { id: 70881, name: 'Kakegurui', original_name: 'Kakegurui', first_air_date: '2017-07-01', genre_ids: [16, 18], vote_count: 200 }
globalThis.fetch = async (url) => {
  const u = String(url)
  if (u.includes('/search/tv')) return new Response(JSON.stringify({ results: u.includes('query=Kakegurui') ? [hit] : [] }))
  if (u.includes('/tv/70881?')) return new Response(JSON.stringify({ name: 'Kakegurui', first_air_date: '2017-07-01', genres: [{ id: 16 }] }))
  if (u.includes('/content_ratings')) return new Response(JSON.stringify({ results: [] }))
  return new Response(JSON.stringify({ results: {} }))
}
`
const FRISCH = '2999-01-01T00:00:00.000Z'
const eintrag = (tmdbId: number): Record<string, unknown> => ({ tmdbId, kind: 'tv', genreIds: [16], fetchedAt: FRISCH })
const wurzel = mkdtempSync(join(tmpdir(), 'tmdb-404-neusuche-'))
try {
  mkdirSync(join(wurzel, 'data'))
  mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
  const t = (id: number, titleEn: string): Record<string, unknown> => ({ id, titleEn, jpYear: 2017, format: 'TV' })
  // 1 tot, Neusuche trifft; 2 tot, Neusuche ohne Treffer; 3 Vermerk anderer Kennung; 4 schon nach dem Vermerk neu gesucht; 5 ohne Vermerk.
  writeFileSync(join(wurzel, 'public', 'data', 'titles.json'), JSON.stringify([t(1, 'Kakegurui'), t(2, 'Nichts'), t(3, 'Kakegurui'), t(4, 'Kakegurui'), t(5, 'Kakegurui')]))
  const vorher = { 1: eintrag(10), 2: eintrag(20), 3: eintrag(30), 4: eintrag(40), 5: eintrag(50) }
  writeFileSync(join(wurzel, 'data', 'tmdb-titles.json'), JSON.stringify(vorher))
  writeFileSync(join(wurzel, 'data', 'tmdb-von-hand.yaml'), '[]\n')
  const vermerke = {
    1: { tmdbId: 10, geprueft: '2999-01-02' },
    2: { tmdbId: 20, geprueft: '2999-01-02' },
    3: { tmdbId: 99, geprueft: '2999-01-02' },
    4: { tmdbId: 40, geprueft: '2998-12-31' },
  }
  writeFileSync(join(wurzel, 'data', 'tmdb-folgen-404.json'), JSON.stringify(vermerke))
  const kulisse = join(wurzel, 'kulisse.mjs')
  writeFileSync(kulisse, KULISSE)
  const r = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), '--import', pathToFileURL(kulisse).href, fileURLToPath(new URL('./fetch-tmdb-titles.ts', import.meta.url))], {
    cwd: wurzel,
    env: { ...process.env, AK_ROOT: wurzel, TMDB_API_KEY: 'kulisse' },
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60_000,
  })
  const nach = JSON.parse(readFileSync(join(wurzel, 'data', 'tmdb-titles.json'), 'utf8')) as Record<string, { tmdbId?: number; fetchedAt?: string }>
  const vermerkeNach = readFileSync(join(wurzel, 'data', 'tmdb-folgen-404.json'), 'utf8')
  pruefe('Prozess endet mit 0', r.status === 0, [r.status, r.stderr.slice(0, 300)])
  pruefe('tote Kennung 10 wird durch den Treffer 70881 ersetzt', nach['1']?.tmdbId === 70881, nach['1'])
  pruefe('tote Kennung 20 ohne Treffer bleibt stehen, wurde aber neu gesucht', nach['2']?.tmdbId === 20 && (nach['2']?.fetchedAt ?? FRISCH) < FRISCH, nach['2'])
  for (const id of ['3', '4', '5']) pruefe(`Titel ${id} bleibt byte-gleich`, JSON.stringify(nach[id]) === JSON.stringify(vorher[Number(id) as 1]), nach[id])
  pruefe('Vermerke bleiben unverändert (Lauf schreibt sie nicht)', vermerkeNach === JSON.stringify(vermerke), vermerkeNach)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('\nTMDB 404 Neusuche: alle Zusicherungen grün.')
