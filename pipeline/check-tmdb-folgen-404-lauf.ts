/**
 * Der echte Lauf von `fetch-tmdb-folgen.ts` gegen eine Kulisse (`AK_ROOT`, Attrappe `tools/tmdb-folgen-mock.mjs`, feste Uhr 24.10.2026):
 * Antwort 404 auf den Serien-Abruf schreibt einen Vermerk in `data/tmdb-folgen-404.json` und keinen Eintrag in `data/tmdb-folgen.json`;
 * eine andere Fehlerantwort (403) schreibt gar nichts; Erfolg räumt einen alten Vermerk ab. Ein Vermerk hält den Titel 29 Tage zurück
 * und lässt ihn am 30. Tag (Grenze der Altersregel) wieder zu; ein Vermerk zu einer anderen TMDB-Kennung zählt nicht.
 * Aufruf: `npm run check:logic`.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const tsx = createRequire(join(wurzel, 'package.json')).resolve('tsx/cli')
const mock = pathToFileURL(join(wurzel, 'tools/tmdb-folgen-mock.mjs')).href

// 900012 antwortet 404, 900013 403, 900014 Erfolg ohne Vermerk, 900015 Vermerk genau 30 Tage alt, 900016 Vermerk 29 Tage alt, 900017 Vermerk anderer Kennung.
const kennungen = [900012, 900013, 900014, 900015, 900016, 900017]
const katalog = kennungen.map((id) => ({ id, titleDe: `Kulisse ${id}`, episodes: 12, streams: [] }))
const luecke = { f: [[1, 'Der Anfang'], [2, '']], de: [[1, 2]] }
const tmdbTitles = Object.fromEntries(kennungen.map((id) => [String(id), { tmdbId: id - 899000, kind: 'tv' }]))
const vorher404 = {
  900015: { tmdbId: 1015, geprueft: '2026-09-24' },
  900016: { tmdbId: 1016, geprueft: '2026-09-25' },
  900017: { tmdbId: 1, geprueft: '2026-10-24' },
}

const kulisse = mkdtempSync(join(tmpdir(), 'tmdb-folgen-404-'))
const schreibe = (pfad: string, inhalt: unknown): void => {
  mkdirSync(dirname(join(kulisse, pfad)), { recursive: true })
  writeFileSync(join(kulisse, pfad), JSON.stringify(inhalt))
}
const lies = (pfad: string): Record<string, unknown> => JSON.parse(readFileSync(join(kulisse, pfad), 'utf8'))
schreibe('public/data/titles.json', katalog)
for (const id of kennungen) schreibe(`public/data/folgen/${id}.json`, luecke)
schreibe('data/tmdb-titles.json', tmdbTitles)
schreibe('data/tmdb-folgen.json', {})
schreibe('data/tmdb-folgen-404.json', vorher404)
writeFileSync(join(kulisse, 'abrufe.txt'), '')

const fehler: string[] = []
try {
  const lauf = spawnSync(process.execPath, [tsx, '--import', mock, join(wurzel, 'pipeline/fetch-tmdb-folgen.ts'), '--limit', '10'], {
    cwd: wurzel,
    encoding: 'utf8',
    env: { ...process.env, AK_ROOT: kulisse, TMDB_API_KEY: 'test' },
  })
  if (lauf.status !== 0) fehler.push(`Lauf endet mit ${lauf.status}: ${lauf.stderr.slice(-300)}`)
  const abrufe = readFileSync(join(kulisse, 'abrufe.txt'), 'utf8').trim().split('\n').join(',')
  if (abrufe !== '1012,1013,1014,1015,1017') fehler.push(`Abrufe ${abrufe}, erwartet 1012,1013,1014,1015,1017`)
  const folgen = Object.keys(lies('data/tmdb-folgen.json')).join(',')
  if (folgen !== '900014,900015,900017') fehler.push(`Einträge ${folgen}, erwartet 900014,900015,900017`)
  const nach = JSON.stringify(lies('data/tmdb-folgen-404.json'))
  const erwartet = JSON.stringify({ 900012: { tmdbId: 1012, geprueft: '2026-10-24' }, 900016: vorher404[900016] })
  if (nach !== erwartet) fehler.push(`Vermerke ${nach}, erwartet ${erwartet}`)
} catch (e) {
  fehler.push(`Ergebnis nicht lesbar: ${(e as Error).message}`)
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`FEHL check-tmdb-folgen-404-lauf: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-tmdb-folgen-404-lauf: 404 → Vermerk ohne Folgeneintrag; 403 → nichts; Erfolg räumt Vermerk ab; 29 Tage halten zurück, 30 nicht.')
