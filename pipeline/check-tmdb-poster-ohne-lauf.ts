/**
 * Prozesstest (15.11.2026): Der Plakatlauf `fetch-tmdb-poster.ts` bedient keinen Titel mit `ohne: true` in `data/tmdb-von-hand.yaml`.
 * Anlass: Kitaro-Shinsei-ban (AniList 10019697) bekam sein Plakat per Namenssuche vom Original zurück, obwohl die Handzeile es abräumt.
 * Die Suche liefert für jeden Namen einen passenden Treffer (Kulisse); je Suchweg (Filme, Serien nur bei aniSearch, Katalogsuche) ein Titel
 * mit und ohne `ohne`. Läuft in `check:logic`.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

/* Jede Suche antwortet mit einem Treffer, der den gesuchten Namen trägt (Animation, 2024); jede Bilderliste mit einem Plakat. */
const STUB = `
globalThis.fetch = async (url) => {
  const u = new URL(String(url))
  if (u.pathname.includes('/search/')) {
    const q = u.searchParams.get('query')
    return new Response(JSON.stringify({ results: [{ id: 777, title: q, name: q, original_title: q, original_name: q, release_date: '2024-01-01', first_air_date: '2024-01-01', genre_ids: [16] }] }), { status: 200 })
  }
  if (u.pathname.endsWith('/images')) return new Response(JSON.stringify({ posters: [{ file_path: '/original.jpg', width: 1200, height: 1600, iso_639_1: 'ja' }] }), { status: 200 })
  return new Response('{}', { status: 404 })
}
`
const titel = (id: number, format: string) => ({ id, slug: `t-${id}`, titleDe: `Fixture ${id}`, titleEn: `Fixture Name ${id}`, jpYear: 2024, format, genres: [], keywords: [], studios: [], streams: [] })
/* 900501/900502 Film (filmeSuchen), 10900503/10900504 Serie ohne Cover (serienOhneCover), 900505/900506 Serie mit Katalogsuche (plakatSuche). */
const OHNE = [900501, 10900503, 900505]
const NORMAL = [900502, 10900504, 900506]

const wurzel = mkdtempSync(join(tmpdir(), 'tmdb-poster-ohne-'))
try {
  mkdirSync(join(wurzel, 'public/data'), { recursive: true })
  mkdirSync(join(wurzel, 'data'), { recursive: true })
  const hand = OHNE.map((id) => `- anilistId: ${id}\n  ohne: true\n  titel: Fixture\n  geprueftAm: '2999-01-01'\n  grund: Kulisse`).join('\n\n')
  writeFileSync(join(wurzel, 'data/tmdb-von-hand.yaml'), hand + '\n')
  const alle = [
    titel(900501, 'MOVIE'), titel(900502, 'MOVIE'),
    titel(10900503, 'TV'), titel(10900504, 'TV'),
    titel(900505, 'TV'), titel(900506, 'TV'),
  ].map((t) => (t.id >= 10_000_000 ? t : { ...t, coverImage: 'https://example.org/c.jpg' }))
  writeFileSync(join(wurzel, 'public/data/titles.json'), JSON.stringify(alle))
  const stub = `data:text/javascript,${encodeURIComponent(STUB)}`
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--import', stub, 'pipeline/fetch-tmdb-poster.ts'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
    env: { ...process.env, AK_ROOT: wurzel, TMDB_API_KEY: 'attrappe' },
  })
  pruefe('Lauf endet mit Exit 0 und der Schlusszeile', r.status === 0 && r.stdout.includes('Titeln mit Plakat'), `${r.status} ${r.stdout.slice(-300)} ${r.stderr.slice(-300)}`)
  const bestand = JSON.parse(readFileSync(join(wurzel, 'data/tmdb-poster.json'), 'utf8')) as Record<string, { p: string } | null>
  for (const id of NORMAL) pruefe(`Kontrolle: ${id} ohne ohne-Zeile bekommt das Plakat der Suche`, bestand[String(id)]?.p === '/original.jpg', JSON.stringify(bestand))
  for (const id of OHNE) pruefe(`${id} mit ohne-Zeile bleibt ohne Eintrag`, !(String(id) in bestand), JSON.stringify(bestand))
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (fehler) {
  console.error(`[tmdb-poster-ohne-lauf] ${fehler} von ${faelle} Fällen rot`)
  process.exit(1)
}
console.log(`[tmdb-poster-ohne-lauf] ${faelle} Fälle grün (Plakatlauf nimmt ohne-Titel aus Filmsuche, Serien-Suche und Katalogsuche aus)`)
