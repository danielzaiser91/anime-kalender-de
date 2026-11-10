/**
 * Prozesstest zur Verdrahtung des Vorrangs der Film-Nachsuche in `fetch-tmdb-titles.ts` (`faelligeTitel`, Option `filmNeusuche`): Mit `--limit 1` und zwei
 * fälligen Fehlschlägen — ein möglicher Film von Oktober, eine Serie von September (älter) — wird der Film neu gesucht, nicht die ältere Serie.
 * Ohne die Verdrahtung käme die Serie dran (Anlass: Miraculous World: New York, 06.11.2026, Fehlschlag vom 12.10.). Läuft in `check:logic`.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

let verletzt = 0
let faelle = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  faelle++
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const KULISSE = `
globalThis.fetch = async (url) => {
  const u = String(url)
  if (u.includes('/search/movie')) return new Response(JSON.stringify({ results: u.includes('query=Kulissenfilm') ? [{ id: 900755, title: 'Kulissenfilm', original_title: 'Kulissenfilm', release_date: '2020-09-25', genre_ids: [16], vote_count: 300 }] : [] }))
  if (u.includes('/movie/900755?')) return new Response(JSON.stringify({ title: 'Kulissenfilm', release_date: '2020-09-25', genres: [{ id: 16 }] }))
  if (u.includes('/release_dates')) return new Response(JSON.stringify({ results: [] }))
  return new Response(JSON.stringify({ results: [] }))
}
`
const wurzel = mkdtempSync(join(tmpdir(), 'tmdb-film-vorrang-'))
try {
  mkdirSync(join(wurzel, 'data'))
  mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
  const titel = [
    { id: 900301, titleEn: 'Kulissenserie', jpYear: 2019, format: 'TV', episodes: 12 },
    { id: 900302, titleEn: 'Kulissenfilm', jpYear: 2021, format: 'ONA', episodes: 1 },
  ]
  writeFileSync(join(wurzel, 'public', 'data', 'titles.json'), JSON.stringify(titel))
  const vorher = {
    900301: { miss: true, fetchedAt: '2026-09-01T00:00:00.000Z' },
    900302: { miss: true, fetchedAt: '2026-10-12T00:00:00.000Z' },
  }
  writeFileSync(join(wurzel, 'data', 'tmdb-titles.json'), JSON.stringify(vorher))
  writeFileSync(join(wurzel, 'data', 'tmdb-von-hand.yaml'), '[]\n')
  writeFileSync(join(wurzel, 'data', 'tmdb-folgen-404.json'), '{}')
  const kulisse = join(wurzel, 'kulisse.mjs')
  writeFileSync(kulisse, KULISSE)
  const r = spawnSync(
    process.execPath,
    ['--import', import.meta.resolve('tsx'), '--import', pathToFileURL(kulisse).href, fileURLToPath(new URL('./fetch-tmdb-titles.ts', import.meta.url)), '--limit', '1'],
    { cwd: wurzel, env: { ...process.env, AK_ROOT: wurzel, TMDB_API_KEY: 'kulisse' }, encoding: 'utf8', windowsHide: true, timeout: 60_000 },
  )
  const nach = JSON.parse(readFileSync(join(wurzel, 'data', 'tmdb-titles.json'), 'utf8')) as Record<string, { tmdbId?: number; fetchedAt?: string }>
  pruefe('Prozess endet mit 0', r.status === 0, [r.status, r.stderr.slice(0, 300)])
  pruefe('der Film (Fehlschlag vom 12.10.) wird mit Limit 1 neu gesucht und gefunden', nach['900302']?.tmdbId === 900755, nach['900302'])
  pruefe('die ältere Serie (01.09.) bleibt in diesem Lauf liegen', JSON.stringify(nach['900301']) === JSON.stringify(vorher[900301]), nach['900301'])
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (verletzt) {
  console.error(`\n${verletzt} von ${faelle} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log(`\nFilm-Vorrang im Lauf: ${faelle} Zusicherungen grün.`)
