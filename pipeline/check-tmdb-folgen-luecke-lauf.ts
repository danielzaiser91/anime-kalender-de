/**
 * Der echte Lauf von `fetch-tmdb-folgen.ts` mit Lückentiteln gegen eine Kulisse (`AK_ROOT`, Attrappe `tools/tmdb-folgen-mock.mjs`):
 * Nur der Titel ohne Anbieter, ohne Eintrag und mit Lücke im Dub-Bereich wird geholt; Titel mit Eintrag, Film, ohne TMDB-Verweis,
 * mit einer Folge und ohne Lücke bleiben draußen. `--nur-luecke` holt nur ihn, der reguläre Lauf danach den Titel mit Anbieter.
 * Fängt, wenn `waehleAbrufe`/`dubLuecke` nicht aufgerufen werden oder falsche Daten bekommen. Aufruf: `npm run check:logic`.
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

const titel = (id: number, episodes: number, mitAnbieter: boolean) => ({
  id,
  titleDe: `Kulisse ${id}`,
  episodes,
  streams: mitAnbieter ? [{ platform: 'netflix', url: `https://www.netflix.com/title/${id}` }] : [],
})
// 900001 Ziel; 900002 ohne Lücke; 900003 mit Eintrag; 900004 Film; 900005 ohne TMDB-Verweis; 900006 eine Folge; 900007 mit Anbieter, ohne Lücke.
const katalog = [titel(900001, 12, false), titel(900002, 12, false), titel(900003, 12, false), titel(900004, 12, false),
  titel(900005, 12, false), titel(900006, 1, false), titel(900007, 12, true)]
const mitLuecke = { f: [[1, 'Der Anfang'], [2, ''], [3, '']], de: [[1, 2]] }
const ohneLuecke = { f: [[1, 'Der Anfang'], [2, '']], de: [[1, 1]] }
const dateien: Record<number, unknown> = { 900001: mitLuecke, 900002: ohneLuecke, 900003: mitLuecke, 900004: mitLuecke, 900005: mitLuecke, 900006: mitLuecke, 900007: ohneLuecke }
const tmdbTitles = Object.fromEntries(katalog.filter((t) => t.id !== 900005).map((t) => [String(t.id), { tmdbId: t.id - 899000, kind: t.id === 900004 ? 'movie' : 'tv' }]))
const bestand = { 900003: { tmdbId: 1003, geholtAm: '2026-10-20', staffeln: 1, folgen: [{ s: 1, e: 1, titel: 'Der Anfang', en: 'Ep 1', datum: '2026-08-20', minuten: 24 }] } }

function lauf(argumente: string[]): { abrufe: string; status: number | null; fehler: string } {
  const kulisse = mkdtempSync(join(tmpdir(), 'tmdb-folgen-luecke-'))
  const schreibe = (pfad: string, inhalt: unknown): void => {
    mkdirSync(dirname(join(kulisse, pfad)), { recursive: true })
    writeFileSync(join(kulisse, pfad), JSON.stringify(inhalt))
  }
  try {
    schreibe('public/data/titles.json', katalog)
    for (const [id, d] of Object.entries(dateien)) schreibe(`public/data/folgen/${id}.json`, d)
    schreibe('data/tmdb-titles.json', tmdbTitles)
    schreibe('data/tmdb-folgen.json', bestand)
    writeFileSync(join(kulisse, 'abrufe.txt'), '')
    const r = spawnSync(process.execPath, [tsx, '--import', mock, join(wurzel, 'pipeline/fetch-tmdb-folgen.ts'), ...argumente], {
      cwd: wurzel,
      encoding: 'utf8',
      env: { ...process.env, AK_ROOT: kulisse, TMDB_API_KEY: 'test' },
    })
    const abrufe = readFileSync(join(kulisse, 'abrufe.txt'), 'utf8').trim().split('\n').join(',')
    return { abrufe, status: r.status, fehler: r.stderr.slice(-300) }
  } finally {
    rmSync(kulisse, { recursive: true, force: true })
  }
}

const fehler: string[] = []
const faelle: [string, string[], string][] = [
  ['--nur-luecke --limit 20', ['--nur-luecke', '--limit', '20'], '1001'],
  ['regulär --limit 5', ['--limit', '5'], '1001,1007'],
  ['regulär --limit 1 (Riegel)', ['--limit', '1'], '1001'],
]
for (const [name, argumente, erwartet] of faelle) {
  const e = lauf(argumente)
  if (e.status !== 0) fehler.push(`${name}: Lauf endet mit ${e.status}: ${e.fehler}`)
  else if (e.abrufe !== erwartet) fehler.push(`${name}: Abrufe ${e.abrufe}, erwartet ${erwartet}`)
}
if (fehler.length) {
  console.error(`FEHL check-tmdb-folgen-luecke-lauf: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-tmdb-folgen-luecke-lauf: nur der Lückentitel ohne Anbieter wird geholt (Probelauf, regulär, Limit 1); Film, Eintrag, Ein-Folgen-Titel und fehlender Verweis bleiben draußen.')
