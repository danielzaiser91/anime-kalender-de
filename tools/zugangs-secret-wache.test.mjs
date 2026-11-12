// Abgleich Repo-Secrets gegen Zugangs-Register: Befunde in beide Richtungen, Nichtauskunft, Verdrahtung in laeufe-aufraeumen als echter Prozess.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { secretBefunde, secretZeilen } from './zugangs-secret-wache.mjs'

const z = (id, ort = 'github-secret') => ({ id, ort })
const REG = { zugaenge: [z('A'), z('B'), z('GITHUB_TOKEN', 'github-automatisch'), z('W', 'worker-secret'), z('V', 'vercel-env')] }
const liste = (...namen) => () => JSON.stringify(namen.map((name) => ({ name, updatedAt: '2026-11-01T00:00:00Z' })))

// Stimmig: Worker-, Vercel- und GITHUB_TOKEN-Einträge sind keine Repo-Secrets und geben keinen Fehlalarm.
assert.deepEqual(secretBefunde(REG.zugaenge, ['A', 'B']), [])
// Rot-Probe: Secret ohne Eintrag.
assert.deepEqual(secretBefunde(REG.zugaenge, ['A', 'B', 'NEU']), ['Zugang: Repo-Secret NEU hat keinen Eintrag in data/zugangs-register.json'])
// Gegenrichtung: Repo-Secret-Eintrag ohne Secret (heute: ANILIST_TOKEN).
assert.equal(secretBefunde(REG.zugaenge, ['A']).length, 1)
assert.match(secretBefunde(REG.zugaenge, ['A'])[0], /B als Repo-Secret/)
// Ein Secret mit Eintrag anderer Art (Worker) zählt als bekannt, nicht als fehlend.
assert.deepEqual(secretBefunde(REG.zugaenge, ['A', 'B', 'W']), [])
// Beide Befunde zugleich, sortiert.
assert.equal(secretBefunde(REG.zugaenge, ['X', 'A']).length, 2)

// Zeilen über gh-Attrappe: Argumente (nur Namen, `--json name`), Befund, Nichtauskunft (Fehler, Müll, leer) ist kein Befund-Alarm über Secrets.
let args
const merkt = (...namen) => (a) => ((args = a), liste(...namen)())
assert.deepEqual(secretZeilen(merkt('A', 'B'), 'o/r', REG), [])
assert.deepEqual(args, ['secret', 'list', '--repo', 'o/r', '--json', 'name'])
assert.equal(secretZeilen(liste('A', 'B', 'NEU'), 'o/r', REG).length, 1)
assert.match(secretZeilen(() => { throw new Error('HTTP 403: Resource not accessible') }, 'o/r', REG)[0], /nicht lesbar \(HTTP 403/)
assert.match(secretZeilen(() => 'kein json', 'o/r', REG)[0], /nicht lesbar/)
assert.match(secretZeilen(() => '[]', 'o/r', REG)[0], /Abgleich ausgelassen/)
assert.match(secretZeilen(() => '[{"id":1}]', 'o/r', REG)[0], /Abgleich ausgelassen/)

// Verdrahtung: laeufe-aufraeumen (Wachphase) druckt die Zeile; Kulisse für `gh secret list`, sonst leere Listen.
const stub = `data:text/javascript,import cp from "node:child_process";import{syncBuiltinESMExports}from "node:module";cp.execFileSync=(c,a)=>a.includes("secret")?JSON.stringify([{name:"LAUF_TOKEN"},{name:"NEU_OHNE_EINTRAG_X"}]):"[]";syncBuiltinESMExports();globalThis.fetch=async()=>new Response("{}",{status:500})`
const ordner = mkdtempSync(join(tmpdir(), 'zugangs-secret-'))
try {
  const gesundheit = join(ordner, 'g.json')
  writeFileSync(gesundheit, '{}')
  const aufraeumen = fileURLToPath(new URL('./laeufe-aufraeumen.mjs', import.meta.url))
  const r = spawnSync(process.execPath, ['--import', stub, aufraeumen, '--trocken', '--gesundheit', gesundheit], { encoding: 'utf8', env: { ...process.env, LAUF_TOKEN: '' }, timeout: 120000 })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /^Zugang: Repo-Secret NEU_OHNE_EINTRAG_X hat keinen Eintrag in data\/zugangs-register\.json$/m)
  assert.doesNotMatch(r.stdout, /Repo-Secret LAUF_TOKEN/)
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
console.log('zugangs-secret-wache: Befunde beide Richtungen, Nichtauskunft und Wachphasen-Verdrahtung ok')
