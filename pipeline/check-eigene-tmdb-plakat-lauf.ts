/**
 * Prozesstest (08.11.2026): Der Plakatlauf `fetch-tmdb-poster.ts` holt das Plakat eines eigenen Titels (`data/eigene-titel.yaml`, Feld `tmdb`).
 * Anlass: „Z wie Zorro – Der Film“ und „Zorros Geheimnis“ standen am 03.11.2026 ohne Bild im Kalender — die Namenssuche findet einen Titel ohne Jahr nie.
 * Der Lauf startet als eigener Prozess in einem Wegwerf-Ordner (`AK_ROOT`), `fetch` ist ersetzt; widerrufene Zeilen und Titel ohne `tmdb` bleiben ohne Abruf.
 * Läuft in `check:logic`.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eigeneTmdbZuordnung } from './lib/eigene-tmdb.ts'

let fehler = 0
let faelle = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  faelle++
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

/* Nur `movie/900123` und `tv/900124` kennen ein Plakat; jede andere Adresse antwortet 404 und steht in `abrufe`. */
const STUB = `
globalThis.fetch = async (url) => {
  const u = String(url)
  if (u.includes('/movie/900123/images')) return new Response(JSON.stringify({ posters: [{ file_path: '/film.jpg', width: 1200, height: 1600, iso_639_1: 'de' }] }), { status: 200 })
  if (u.includes('/tv/900124/images')) return new Response(JSON.stringify({ posters: [{ file_path: '/serie.jpg', width: 1000, height: 1500, iso_639_1: 'en' }] }), { status: 200 })
  console.log('ABRUF ' + u.replace(/api_key=.*/, ''))
  return new Response('{}', { status: 404 })
}
`
const zeile = (nr: number, name: string, extra: string[]) =>
  [`- nr: ${nr}`, `  name: ${name}`, '  format: MOVIE', '  anbieter: [joyn]', '  tag: 2999-01-02', '  sources: [https://example.org/a]', '  zitat: "Z"', ...extra].join('\n')

const roh = { format: 'MOVIE', anbieter: ['joyn'], tag: '2999-01-02', sources: ['https://x'], zitat: 'z' }
const z = eigeneTmdbZuordnung([
  { ...roh, nr: 7, name: 'A', tmdb: 'movie/11' },
  { ...roh, nr: 8, name: 'B', tmdb: 'tv/22' },
  { ...roh, nr: 9, name: 'C', tmdb: 'movie/33', widerrufen: 'x' },
  { ...roh, nr: 10, name: 'D', tmdb: 'movie/44', zuId: 5 },
  { ...roh, nr: 11, name: 'E', coverGrund: 'g' },
])
pruefe('Zuordnung: Kennung = 5 Mio. + nr, Art und Werk wie in der Handdatei', JSON.stringify(z['5000007']) === '{"tmdbId":11,"kind":"movie"}' && JSON.stringify(z['5000008']) === '{"tmdbId":22,"kind":"tv"}', JSON.stringify(z))
pruefe('Zuordnung: widerrufene, umgezogene und Zeilen ohne tmdb fehlen', Object.keys(z).join() === '5000007,5000008', JSON.stringify(z))

const wurzel = mkdtempSync(join(tmpdir(), 'eigene-tmdb-plakat-'))
try {
  mkdirSync(join(wurzel, 'public/data'), { recursive: true })
  mkdirSync(join(wurzel, 'data'), { recursive: true })
  const yaml = [
    zeile(910001, 'Fixture Film', ['  tmdb: movie/900123']),
    zeile(910002, 'Fixture Serie', ['  tmdb: tv/900124']),
    zeile(910003, 'Fixture Widerrufen', ['  tmdb: movie/900123', '  widerrufen: Fixture, 2999-01-03']),
    zeile(910004, 'Fixture Ohne Plakat', ['  coverGrund: TMDB führt das Werk nicht']),
  ].join('\n\n')
  writeFileSync(join(wurzel, 'data/eigene-titel.yaml'), yaml)
  const titel = [910001, 910002, 910004].map((nr) => ({ id: 5_000_000 + nr, slug: `t-${nr}`, titleDe: `Fixture ${nr}`, format: 'MOVIE', genres: [], keywords: [], studios: [], streams: [] }))
  writeFileSync(join(wurzel, 'public/data/titles.json'), JSON.stringify(titel))
  const stub = `data:text/javascript,${encodeURIComponent(STUB)}`
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--import', stub, 'pipeline/fetch-tmdb-poster.ts'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
    env: { ...process.env, AK_ROOT: wurzel, TMDB_API_KEY: 'attrappe' },
  })
  pruefe('Lauf endet mit Exit 0 und der Schlusszeile', r.status === 0 && r.stdout.includes('Titeln mit Plakat'), `${r.status} ${r.stdout.slice(-300)} ${r.stderr.slice(-300)}`)
  const bestand = JSON.parse(readFileSync(join(wurzel, 'data/tmdb-poster.json'), 'utf8')) as Record<string, { p: string; w: number; h: number; l: string | null } | null>
  pruefe('Film (movie/900123) trägt sein Plakat', bestand['5910001']?.p === '/film.jpg' && bestand['5910001']?.w === 1200, JSON.stringify(bestand))
  pruefe('Serie (tv/900124) trägt ihr Plakat', bestand['5910002']?.p === '/serie.jpg' && bestand['5910002']?.l === 'en', JSON.stringify(bestand))
  pruefe('widerrufene Zeile: kein Eintrag', !('5910003' in bestand), JSON.stringify(bestand))
  pruefe('Zeile mit coverGrund statt tmdb: kein Plakateintrag aus der Zuordnung (die Namenssuche setzt höchstens null)', !bestand['5910004'], JSON.stringify(bestand))
  pruefe('kein Abruf der Namenssuche für Titel mit Zuordnung', !r.stdout.includes('Fixture Film') && !r.stdout.includes('Fixture 910001') && !r.stdout.includes('Fixture 910002'), r.stdout.slice(-400))
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

if (fehler) {
  console.error(`[eigene-tmdb-plakat-lauf] ${fehler} von ${faelle} Fällen rot`)
  process.exit(1)
}
console.log(`[eigene-tmdb-plakat-lauf] ${faelle} Fälle grün (Plakatlauf holt Plakate eigener Titel über tmdb: movie|tv/<Kennung>)`)
