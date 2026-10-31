/**
 * Verdrahtung: `schreibeFolgenDateien` führt doppelte aniSearch-Nummern zusammen (Kulisse über `AK_ROOT`, echter Aufrufer).
 * Zeilen wörtlich nach aniSearch 17808 (Sieben Schatten, Folge 1 zweimal) und 17327 (Folge 13 als Teil 1 und 2: bleibt).
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const wurzelRepo = join(import.meta.dirname, '..')
const tsx = createRequire(join(wurzelRepo, 'package.json')).resolve('tsx/cli')
const wurzel = mkdtempSync(join(tmpdir(), 'folgen-nummern-bau-'))
try {
  for (const d of ['data', 'data/cache', 'public/data']) mkdirSync(join(wurzel, d), { recursive: true })
  const folgen = [
    { nr: 1, datum: '2020-01-01', minuten: 2, ja: 'Operation 1: Shichi Kage' },
    { nr: 1, minuten: 2, de: 'Operation 1: Schattenwahrheiten!' },
    { nr: 2, datum: '2020-01-08', minuten: 2, de: 'Operation 2: Schattenwahrheiten!' },
    { nr: 3, datum: '2020-01-15', minuten: 15, de: 'Teil 1' },
    { nr: 3, datum: '2020-03-15', minuten: 9, de: 'Teil 2' },
  ]
  writeFileSync(join(wurzel, 'data/anisearch-folgen.json'), JSON.stringify({ 777: { folgen } }))
  writeFileSync(join(wurzel, 'data/anisearch.json'), JSON.stringify({ 900001: { anisearchId: 777 } }))
  writeFileSync(join(wurzel, 'data/folgen-hinweise.yaml'), '[]\n')
  writeFileSync(join(wurzel, 'data/kino-ankuendigungen.yaml'), '[]\n')
  const r = spawnSync(process.execPath, [tsx, join(wurzelRepo, 'pipeline/lib/kulisse-folgen-nummern.ts')], { env: { ...process.env, AK_ROOT: wurzel }, encoding: 'utf8', windowsHide: true, timeout: 120_000 })
  assert.equal(r.status, 0, r.stderr.slice(-400))
  const zeilen = JSON.parse(r.stdout.trim().split('\n').pop()!) as [number, string][]
  assert.deepEqual(zeilen.map(([nr]) => nr), [1, 2, 3, 3], 'Folge 1 einmal, die echte Doppelung bleibt')
  assert.equal(zeilen[0]![1], 'Operation 1: Schattenwahrheiten!')
  assert.match(r.stdout, /1 doppelte Nummern aus aniSearch zusammengeführt/)
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
console.log('check-folgen-nummern-bau: ok (Bau führt doppelte Nummer zusammen, Teil 1/2 bleibt, Logzeile zählt)')
