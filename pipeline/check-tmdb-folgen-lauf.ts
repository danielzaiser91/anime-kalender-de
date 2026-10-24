/**
 * Der echte Lauf von `fetch-tmdb-folgen.ts` gegen eine Kulisse (`AK_ROOT`, Attrappe `tools/tmdb-folgen-mock.mjs`, feste Uhr 24.10.2026):
 * Bei `--limit 3` kommt die laufende Serie mit titelloser Folge zuerst, dann die Grundfälligen in Katalogreihenfolge; die ruhige
 * Serie und der Rest hinter dem Limit bleiben unberührt. Fängt, wenn die Auswahl nicht aufgerufen wird oder falsche Daten bekommt.
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

const titel = (id: number) => ({ id, titleDe: `Kulisse ${id}`, episodes: 12, streams: [{ platform: 'netflix', url: `https://www.netflix.com/title/${id}` }] })
const folge = (e: number, name: string, datum: string) => ({ s: 1, e, titel: name, en: `Ep ${e}`, datum, minuten: 24 })
const eintrag = (tmdbId: number, geholtAm: string, ...folgen: ReturnType<typeof folge>[]) => ({ tmdbId, geholtAm, staffeln: 1, folgen })

// Katalog: 900001/2 alt, 900003 ruhig (echte Titel, 8 Tage), 900004 laufend mit Platzhalter, 900005 nie geholt, 900006 alt (hinter dem Limit).
const katalog = [900001, 900002, 900003, 900004, 900005, 900006].map(titel)
const bestand = {
  900001: eintrag(1001, '2026-09-01', folge(1, 'Der Anfang', '2026-08-20')),
  900002: eintrag(1002, '2026-09-01', folge(1, 'Der Anfang', '2026-08-20')),
  900003: eintrag(1003, '2026-10-16', folge(1, 'Der Anfang', '2026-10-15')),
  900004: eintrag(1004, '2026-10-16', folge(1, 'Der Anfang', '2026-10-10'), folge(2, 'Folge 2', '2026-10-15')),
  900006: eintrag(1006, '2026-09-01', folge(1, 'Der Anfang', '2026-08-20')),
}
const tmdbTitles = Object.fromEntries(katalog.map((t) => [String(t.id), { tmdbId: t.id - 899000, kind: 'tv' }]))

const kulisse = mkdtempSync(join(tmpdir(), 'tmdb-folgen-lauf-'))
const schreibe = (pfad: string, inhalt: unknown): void => {
  mkdirSync(dirname(join(kulisse, pfad)), { recursive: true })
  writeFileSync(join(kulisse, pfad), JSON.stringify(inhalt))
}
schreibe('public/data/titles.json', katalog)
schreibe('data/tmdb-titles.json', tmdbTitles)
schreibe('data/tmdb-folgen.json', bestand)
writeFileSync(join(kulisse, 'abrufe.txt'), '')

const fehler: string[] = []
try {
  const lauf = spawnSync(process.execPath, [tsx, '--import', mock, join(wurzel, 'pipeline/fetch-tmdb-folgen.ts'), '--limit', '3'], {
    cwd: wurzel,
    encoding: 'utf8',
    env: { ...process.env, AK_ROOT: kulisse, TMDB_API_KEY: 'test' },
  })
  if (lauf.status !== 0) fehler.push(`Lauf endet mit ${lauf.status}: ${lauf.stderr.slice(-300)}`)
  const abrufe = readFileSync(join(kulisse, 'abrufe.txt'), 'utf8').trim().split('\n').join(',')
  if (abrufe !== '1004,1001,1002') fehler.push(`Abrufreihenfolge ${abrufe}, erwartet 1004,1001,1002`)
  const neu = JSON.parse(readFileSync(join(kulisse, 'data/tmdb-folgen.json'), 'utf8')) as Record<string, { geholtAm: string }>
  const stand = Object.fromEntries(Object.entries(neu).map(([k, v]) => [k, v.geholtAm]))
  const erwartet = { 900001: '2026-10-24', 900002: '2026-10-24', 900003: '2026-10-16', 900004: '2026-10-24', 900006: '2026-09-01' }
  if (JSON.stringify(stand) !== JSON.stringify(erwartet)) fehler.push(`Stand ${JSON.stringify(stand)}, erwartet ${JSON.stringify(erwartet)}`)
} catch (e) {
  fehler.push(`Ergebnis nicht lesbar: ${(e as Error).message}`)
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}
if (fehler.length) {
  console.error(`FEHL check-tmdb-folgen-lauf: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-tmdb-folgen-lauf: laufende Serie zuerst, Limit 3 gehalten, ruhige und überzählige Titel unberührt.')
