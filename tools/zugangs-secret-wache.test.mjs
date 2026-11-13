// Abgleich Repo-Secrets gegen Zugangs-Register: Befunde in beide Richtungen, Nichtauskunft, Verdrahtung in laeufe-aufraeumen (auch CI-Auslassung) und `--secrets` als echter Prozess.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { legeGhAttrappe } from './gh-attrappe.mjs'
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

const REPO = 'danielzaiser91/anime-kalender-de'
const BEFEHL = `secret list --repo ${REPO} --json name`
// Verdrahtung: laeufe-aufraeumen (Wachphase) druckt die Zeile; Kulisse für `gh secret list` verlangt genau das Repo, sonst leere Listen.
// Ruft die Kulisse `gh secret list`, steht SECRETAUFRUF auf stderr (Beleg, dass die CI-Auslassung wirklich nicht ruft).
const stub = `data:text/javascript,import cp from "node:child_process";import{syncBuiltinESMExports}from "node:module";cp.execFileSync=(c,a)=>{if(!a.includes("secret"))return "[]";process.stderr.write("SECRETAUFRUF\\n");if(a.join(" ")!=="${BEFEHL}")throw new Error("falsche Parameter");return JSON.stringify([{name:"LAUF_TOKEN"},{name:"NEU_OHNE_EINTRAG_X"}])};syncBuiltinESMExports();globalThis.fetch=async()=>new Response("{}",{status:500})`
const ordner = mkdtempSync(join(tmpdir(), 'zugangs-secret-'))
const lauf = (argumente, env) => spawnSync(process.execPath, argumente, { encoding: 'utf8', env: { ...process.env, ...env }, timeout: 120000 })
try {
  const gesundheit = join(ordner, 'g.json')
  writeFileSync(gesundheit, '{}')
  const aufraeumen = fileURLToPath(new URL('./laeufe-aufraeumen.mjs', import.meta.url))
  const wache = (env) => lauf(['--import', stub, aufraeumen, '--trocken', '--gesundheit', gesundheit], { LAUF_TOKEN: '', GITHUB_ACTIONS: '', ...env })
  const r = wache({})
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /^Zugang: Repo-Secret NEU_OHNE_EINTRAG_X hat keinen Eintrag in data\/zugangs-register\.json$/m)
  assert.doesNotMatch(r.stdout, /Repo-Secret LAUF_TOKEN/)
  assert.match(r.stderr, /SECRETAUFRUF/)
  // In der CI (GITHUB_ACTIONS gesetzt) fehlt die Zeile, und `gh secret list` wird nicht gerufen (das GITHUB_TOKEN bekäme 403).
  const ci = wache({ GITHUB_ACTIONS: 'true' })
  assert.equal(ci.status, 0, ci.stderr)
  assert.doesNotMatch(ci.stdout, /Repo-Secret|Secret-Liste/)
  assert.doesNotMatch(ci.stderr, /SECRETAUFRUF/)

  // `--secrets` als Prozess mit gh-Attrappe über GH_BIN: Befund → 1, Gleichstand → 0, Nichtauskunft → 1.
  const waechter = fileURLToPath(new URL('./zugangs-waechter.mjs', import.meta.url))
  const register = JSON.parse(readFileSync(new URL('../data/zugangs-register.json', import.meta.url), 'utf8'))
  const ids = register.zugaenge.filter((e) => e.ort === 'github-secret').map((e) => e.id)
  const secrets = (inhalt, nr) => {
    const dir = join(ordner, `gh${nr}`)
    mkdirSync(dir)
    const antwort = join(dir, 'antwort.json')
    writeFileSync(antwort, inhalt)
    const env = legeGhAttrappe(dir, { befehl: BEFEHL, antwortDatei: antwort })
    const bin = join(dir, process.platform === 'win32' ? 'gh.exe' : 'gh')
    // PATH bleibt unverändert: nur GH_BIN führt zur Attrappe (sonst fände auch ein fest verdrahtetes `gh` sie).
    return lauf([waechter, '--secrets'], { ...env, PATH: process.env.PATH, GH_BIN: bin, GITHUB_REPOSITORY: '' })
  }
  const namen = (...n) => JSON.stringify(n.map((name) => ({ name })))
  const befund = secrets(namen(...ids, 'NEU_OHNE_EINTRAG_X'), 1)
  assert.equal(befund.status, 1, befund.stdout + befund.stderr)
  assert.match(befund.stdout, /✗ Zugang: Repo-Secret NEU_OHNE_EINTRAG_X hat keinen Eintrag/)
  const gleich = secrets(namen(...ids), 2)
  assert.equal(gleich.status, 0, gleich.stdout + gleich.stderr)
  assert.match(gleich.stdout, /stimmen überein/)
  const unklar = secrets('kein json', 3)
  assert.equal(unklar.status, 1, unklar.stdout + unklar.stderr)
  assert.match(unklar.stdout, /nicht lesbar/)
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
console.log('zugangs-secret-wache: Befunde beide Richtungen, Nichtauskunft, Wachphasen-Verdrahtung samt CI-Auslassung und --secrets-Prozess (Befund/Gleichstand/Nichtauskunft) ok')
