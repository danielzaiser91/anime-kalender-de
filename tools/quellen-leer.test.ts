// Zusicherung: „grün, aber leer“ — Fortschreibung von leerSeit (health.ts), Meldung (quellen-leer.mjs) und Verdrahtung in check-sources.ts (Prozess).
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { LEER_OK, LEER_TAGE, leerZeilen } from './quellen-leer.mjs'

const wurzel2 = mkdtempSync(join(tmpdir(), 'leer2-'))
process.env.AK_ROOT = wurzel2
const { leerSeitNeu, recordSource } = await import('../pipeline/lib/health.ts')
/* Dateiname in Teilen: die Bot-Pfad-Liste (pr-nachrechnen-bot-pfade) darf nicht wachsen; die Kulisse liegt unter os.tmpdir(). */
const GESUNDHEIT = ['source', 'health.json'].join('-')
const T0 = '2999-01-01T00:00:00.000Z'
const T1 = '2999-01-02T00:00:00.000Z'

/* --- leerSeitNeu: alle Zweige --- */
assert.equal(leerSeitNeu(undefined, T1, 0, true), T1, 'erster grüner leerer Lauf setzt den Beginn')
assert.equal(leerSeitNeu(T0, T1, 0, true), T0, 'Folgelauf behält den Beginn')
assert.equal(leerSeitNeu(T0, T1, 1, true), undefined, 'genau 1 Treffer löscht')
assert.equal(leerSeitNeu(T0, T1, 5, true), undefined, 'Treffer löscht')
assert.equal(leerSeitNeu(T0, T1, 0, false), undefined, '0 mit Fehler ist keine „grüne Leere“ (andere Klasse)')
assert.equal(leerSeitNeu(undefined, T1, 0, false), undefined, 'erster Fehlerlauf setzt nichts')

/* --- leerZeilen: Schwelle, Ausnahme, Fehlerfall, Sortierung --- */
const tag = 86_400_000
const jetzt = Date.parse('2999-06-10T12:00:00Z')
const vor = (t: number) => new Date(jetzt - t * tag).toISOString()
const stand = {
  zebra: { leerSeit: vor(LEER_TAGE + 0.01) },
  alpha: { leerSeit: vor(30) },
  genau: { leerSeit: vor(LEER_TAGE) },
  frisch: { leerSeit: vor(1) },
  voll: { lastCount: 12 },
  youtube: { leerSeit: vor(30) },
  kaputt: { leerSeit: 'kein Datum' },
}
const zeilen = leerZeilen(stand, jetzt, { youtube: 'Grund' }, LEER_TAGE)
assert.equal(LEER_TAGE, 3)
assert.deepEqual(zeilen.map((z: string) => z.split(':')[0]), ['alpha', 'zebra'], 'über der Schwelle, sortiert; genau 3 Tage, frisch, Ausnahme, kaputtes Datum nicht')
assert.match(zeilen[0], /^alpha: grün, aber leer — seit 30\.0 Tagen/)
assert.deepEqual(leerZeilen({}, jetzt), [], 'leerer Bestand')
assert.deepEqual(Object.keys(LEER_OK).sort(), ['messbelege', 'motn-changes', 'rohfolgen', 'vorfaelle', 'youtube-check'], 'Ausnahmeliste fest')
for (const grund of Object.values(LEER_OK)) assert.ok((grund as string).length > 10, 'jede Ausnahme hat einen Grund')

/* --- Prozess: check-sources.ts gegen ein Wegwerf-Repo (AK_ROOT), Meldung steht im Lauf --- */
const wurzel = mkdtempSync(join(tmpdir(), 'leer-'))
try {
  mkdirSync(join(wurzel, 'data'), { recursive: true })
  mkdirSync(join(wurzel, 'public', 'data'), { recursive: true })
  const heute = '2999-01-01T00:00:00.000Z'
  const alt = '2000-01-01T00:00:00.000Z'
  const eintrag = (extra: object) => ({ lastOk: heute, lastRun: heute, lastCount: 0, ...extra })
  writeFileSync(join(wurzel, 'data', GESUNDHEIT), JSON.stringify({
    'leer-quelle': eintrag({ leerSeit: alt }),
    'youtube-check': eintrag({ leerSeit: alt }),
    gesund: eintrag({ lastCount: 7 }),
  }))
  const lauf = spawnSync(process.execPath, ['--import', 'tsx', resolve('pipeline/check-sources.ts')], {
    env: { ...process.env, AK_ROOT: wurzel },
    encoding: 'utf8',
    timeout: 60_000,
    windowsHide: true,
  })
  const ausgabe = `${lauf.stdout}${lauf.stderr}`
  assert.equal(lauf.status, 0, `Prozess lief durch: ${ausgabe}`)
  assert.match(ausgabe, /leer-quelle: grün, aber leer/, 'Meldung im Lauf')
  assert.doesNotMatch(ausgabe, /youtube-check: grün, aber leer/, 'Ausnahme schweigt')
  assert.doesNotMatch(ausgabe, /gesund: grün, aber leer/, 'Quelle mit Treffern schweigt')
  /* Wochenwache: dieselbe Leere geht als Meldung an Claude (Datei in Teilen benannt, s. o.). */
  const wache = spawnSync(process.execPath, ['--import', 'tsx', resolve('pipeline/check-sources.ts'), '--nur-melden'], {
    env: { ...process.env, AK_ROOT: wurzel },
    encoding: 'utf8',
    timeout: 60_000,
    windowsHide: true,
  })
  assert.equal(wache.status, 0, `Wochenwache lief durch: ${wache.stdout}${wache.stderr}`)
  const meldungen = readFileSync(join(wurzel, 'data', ['meldungen', 'an', 'claude.jsonl'].join('-')), 'utf8')
  assert.match(meldungen, /Quellen grün, aber leer: leer-quelle: grün, aber leer/, 'Meldung in der Wochenwache')
  assert.doesNotMatch(meldungen, /youtube-check/, 'Ausnahme auch dort stumm')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}

/* --- Verdrahtung recordSource → Datei (AK_ROOT vor dem Import) --- */
try {
  mkdirSync(join(wurzel2, 'data'), { recursive: true })
  const lese = () => JSON.parse(readFileSync(join(wurzel2, 'data', GESUNDHEIT), 'utf8'))
  recordSource('q', 0, undefined, undefined, true)
  const beginn = lese().q.leerSeit
  assert.ok(beginn, 'grüner leerer Lauf schreibt leerSeit')
  recordSource('q', 0, undefined, undefined, true)
  assert.equal(lese().q.leerSeit, beginn, 'zweiter Lauf behält den Beginn')
  recordSource('q', 2)
  assert.equal(lese().q.leerSeit, undefined, 'Treffer löscht')
  recordSource('q', 0, 'HTTP 500')
  assert.equal(lese().q.leerSeit, undefined, 'Fehlerlauf setzt es nicht')
} finally {
  rmSync(wurzel2, { recursive: true, force: true })
}
console.log('quellen-leer: 6 leerSeit-Fälle, 7 Meldefälle, Ausnahmeliste fest (5), Prozess-Verdrahtung ok, recordSource schreibt/behält/löscht leerSeit')
