/**
 * Prozesstest: `fetch-tmdb-titles.ts` nimmt einen Titel, der in diesem Lauf eine eigene TMDB-Kennung (hier: Film) bekommt, aus der Staffel 0
 * (`data/tmdb-staffel0.json`); seine Bilder bleiben als Cover stehen (sonst schlägt die Ratsche `check:cover-vorschau-bestand` an), Titel ohne Treffer bleiben unberührt.
 * Anlass: Sammler-PR 3457 (11.11.2026), 28 Titel mit Film-Kennung und Staffel-0-Eintrag zugleich → `check-tmdb-staffel0.ts` rot. Läuft in `check:logic`.
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
  if (u.includes('/search/movie')) return new Response(JSON.stringify({ results: u.includes('query=Kulissenfilm') ? [{ id: 900755, title: 'Kulissenfilm', original_title: 'Kulissenfilm', release_date: '2021-09-25', genre_ids: [16], vote_count: 300 }] : [] }))
  if (u.includes('/movie/900755?')) return new Response(JSON.stringify({ title: 'Kulissenfilm', release_date: '2021-09-25', genres: [{ id: 16 }] }))
  return new Response(JSON.stringify({ results: [] }))
}
`
const lies = (wurzel: string, datei: string): Record<string, Record<string, unknown>> => JSON.parse(readFileSync(join(wurzel, 'data', datei), 'utf8'))
const eintrag = (pp: string, sp: string) => ({ tmdbId: 5, e: 1, tage: 0, laenge: 0, name: true, inhaltAm: '2026-10-14', pp, sp })

const wurzel = mkdtempSync(join(tmpdir(), 'tmdb-staffel0-eigene-'))
try {
  mkdirSync(join(wurzel, 'data'))
  mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
  const titel = [
    { id: 900311, titleEn: 'Kulissenfilm', jpYear: 2021, format: 'ONA', episodes: 1 },
    { id: 900312, titleEn: 'Ohne Treffer', jpYear: 2021, format: 'ONA', episodes: 1 },
    { id: 900313, titleEn: 'Kulissenfilm', jpYear: 2021, format: 'ONA', episodes: 1 },
  ]
  writeFileSync(join(wurzel, 'public', 'data', 'titles.json'), JSON.stringify(titel))
  const alt = { miss: true, fetchedAt: '2026-10-01T00:00:00.000Z' }
  writeFileSync(join(wurzel, 'data', 'tmdb-titles.json'), JSON.stringify({ 900311: alt, 900312: alt, 900313: alt }))
  writeFileSync(join(wurzel, 'data', 'tmdb-von-hand.yaml'), '[]\n')
  writeFileSync(join(wurzel, 'data', 'tmdb-folgen-404.json'), '{}')
  writeFileSync(join(wurzel, 'data', 'tmdb-staffel0.json'), JSON.stringify({ 900311: eintrag('/p1.jpg', '/s1.jpg'), 900312: eintrag('/p2.jpg', '/s2.jpg'), 900313: eintrag('/p3.jpg', '/s3.jpg') }))
  writeFileSync(join(wurzel, 'data', 'tmdb-poster.json'), JSON.stringify({ 900311: { p: '/p1.jpg' }, 900312: { p: '/p2.jpg' }, 900313: { p: '/fremd.jpg' } }))
  writeFileSync(join(wurzel, 'data', 'tmdb-banner.json'), JSON.stringify({ 900311: { p: '/s1.jpg' }, 900312: { p: '/s2.jpg' }, 900313: { p: '/s3.jpg' } }))
  const kulisse = join(wurzel, 'kulisse.mjs')
  writeFileSync(kulisse, KULISSE)
  const lauf = () =>
    spawnSync(
      process.execPath,
      ['--import', import.meta.resolve('tsx'), '--import', pathToFileURL(kulisse).href, fileURLToPath(new URL('./fetch-tmdb-titles.ts', import.meta.url))],
      { cwd: wurzel, env: { ...process.env, AK_ROOT: wurzel, TMDB_API_KEY: 'kulisse' }, encoding: 'utf8', windowsHide: true, timeout: 60_000 },
    )
  const r = lauf()
  const titles = lies(wurzel, 'tmdb-titles.json')
  const s0 = lies(wurzel, 'tmdb-staffel0.json')
  const poster = lies(wurzel, 'tmdb-poster.json')
  const banner = lies(wurzel, 'tmdb-banner.json')
  pruefe('Prozess endet mit 0', r.status === 0, [r.status, r.stderr.slice(0, 300)])
  pruefe('Kulisse: 900311 und 900313 bekommen die Film-Kennung, 900312 nicht', titles['900311']?.tmdbId === 900755 && titles['900313']?.tmdbId === 900755 && !titles['900312']?.tmdbId, titles)
  pruefe('Titel mit eigener Kennung steht nicht mehr in der Staffel 0', !('900311' in s0) && !('900313' in s0), Object.keys(s0))
  pruefe('Titel ohne Treffer behält seinen Staffel-0-Eintrag', JSON.stringify(s0['900312']) === JSON.stringify(eintrag('/p2.jpg', '/s2.jpg')), s0['900312'])
  pruefe('Plakat und Banner des gestrichenen Eintrags bleiben als Cover', poster['900311']?.p === '/p1.jpg' && banner['900311']?.p === '/s1.jpg', [poster['900311'], banner['900311']])
  pruefe('ein fremdes Plakat und das Banner des zweiten Titels bleiben', poster['900313']?.p === '/fremd.jpg' && banner['900313']?.p === '/s3.jpg', [poster['900313'], banner['900313']])
  pruefe('Bilder des Titels ohne Treffer bleiben', poster['900312']?.p === '/p2.jpg' && banner['900312']?.p === '/s2.jpg', [poster['900312'], banner['900312']])
  pruefe('Logzeile nennt die gestrichenen Titel', /2 Titel mit eigener Kennung aus der Staffel 0 genommen: 900311, 900313/.test(r.stdout + r.stderr), (r.stdout + r.stderr).slice(-400))
  /* Genau ein Titel mit Kennung (Schwelle 1): zweiter Lauf, 900312 ist noch nicht wieder fällig. */
  writeFileSync(join(wurzel, 'data', 'tmdb-staffel0.json'), JSON.stringify({ 900311: eintrag('/p1.jpg', '/s1.jpg'), 900312: eintrag('/p2.jpg', '/s2.jpg') }))
  const r2 = lauf()
  const s0b = lies(wurzel, 'tmdb-staffel0.json')
  pruefe('zweiter Lauf: genau ein Titel mit Kennung wird gestrichen, der andere bleibt', r2.status === 0 && !('900311' in s0b) && '900312' in s0b, [r2.status, Object.keys(s0b)])
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (verletzt) {
  console.error(`\n${verletzt} von ${faelle} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log(`\nStaffel 0 gegen eigene Kennung im Lauf: ${faelle} Zusicherungen grün.`)
