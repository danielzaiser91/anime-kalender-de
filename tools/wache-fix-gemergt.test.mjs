// Zusatz „Änderung an Schreiber oder Workflow gemergt“ an der ALARM-Zeile: Bezugspunkt letzter Lauf, strikte Grenze, Pfadzuordnung aus Schreiber und Workflow,
// Gegenfälle, Gitfehler, Verdrahtung in laeufe-aufraeumen als Prozess (Wegwerf-Repo mit festen Commit-Zeiten).
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { eskalationsZeilen } from './wache-eskalation.mjs'
import { commitsZuPfaden, fixGemergtText, fixZusatz, quellenPfade } from './wache-fix-gemergt.mjs'

// Reine Regel: strikt nach dem Bezugspunkt, neuester gewinnt, Datum aus dem Commit.
const c = (sha, iso) => ({ sha, iso })
const LAUF = '2026-10-05T14:58:03.000Z'
assert.equal(fixGemergtText([c('aaa1111', '2026-10-05T14:58:04.000Z')], LAUF), ' — Änderung an Schreiber oder Workflow gemergt 2026-10-05 (aaa1111), nächster Lauf steht aus')
assert.equal(fixGemergtText([c('aaa1111', LAUF)], LAUF), '', 'genau zur Zeit des Laufs: der Lauf kannte den Stand')
assert.equal(fixGemergtText([c('aaa1111', '2026-10-05T14:58:02.000Z')], LAUF), '')
assert.equal(fixGemergtText([], LAUF), '')
assert.equal(fixGemergtText([c('alt0000', '2026-10-10T10:00:00.000Z'), c('neu1111', '2026-10-20T10:00:00.000Z'), c('mit2222', '2026-10-15T10:00:00.000Z')], LAUF), ' — Änderung an Schreiber oder Workflow gemergt 2026-10-20 (neu1111), nächster Lauf steht aus')
assert.equal(fixGemergtText([c('aaa1111', '2026-10-20T10:00:00.000Z')], 'kein Datum'), '')

// Zusatz-Funktion mit Attrappen: Bezugspunkt lastRun vor lastOk, sonst lastOk, sonst nichts; Fehler schweigen.
const commits = [c('fix1234', '2026-10-25T10:00:00.000Z')]
const mit = fixZusatz('x', () => commits, () => ['a.ts'])
assert.equal(mit('q', { lastOk: '2026-10-01T00:00:00Z', lastRun: '2026-10-26T00:00:00Z' }), '', 'lastRun (neuer) schlägt lastOk')
assert.match(mit('q', { lastOk: '2026-10-26T00:00:00Z', lastRun: '2026-10-01T00:00:00Z' }), /fix1234/)
assert.match(mit('q', { lastOk: '2026-10-01T00:00:00Z' }), /fix1234/, 'ohne lastRun gilt lastOk')
assert.equal(mit('q', {}), '')
assert.equal(mit('q', undefined), '')
assert.equal(fixZusatz('x', () => commits, () => [])('q', { lastRun: LAUF }), '', 'Quelle ohne Pfade')
assert.equal(fixZusatz('x', () => { throw new Error('git') }, () => ['a.ts'])('q', { lastRun: LAUF }), '', 'Gitfehler')
// Alarm bleibt, Zusatz hängt nur an: die Zeile ohne Zusatz ist ein Präfix.
const stand = { q: { lastOk: '2026-09-01T00:00:00Z', lastRun: '2026-09-02T00:00:00Z' } }
const jetzt = Date.parse('2026-10-25T12:00:00Z')
const ohne = eskalationsZeilen(stand, jetzt, { q: 9 })
const voll = eskalationsZeilen(stand, jetzt, { q: 9 }, mit)
assert.equal(ohne.length, 1)
assert.equal(voll[0], ohne[0] + ' — Änderung an Schreiber oder Workflow gemergt 2026-10-25 (fix1234), nächster Lauf steht aus')
assert.deepEqual(eskalationsZeilen({ q: { lastOk: '2026-10-24T00:00:00Z' } }, jetzt, { q: 9 }, mit), [], 'ohne Alarm kein Zusatz')

const wegwerf = mkdtempSync(join(tmpdir(), 'wache-fix-gemergt-'))
const repo = join(wegwerf, 'repo')
const gitIn = (zeit, ...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], {
  cwd: repo,
  encoding: 'utf8',
  windowsHide: true,
  env: { ...process.env, GIT_AUTHOR_DATE: zeit, GIT_COMMITTER_DATE: zeit },
})
const schreibe = (datei, text) => {
  mkdirSync(dirname(join(repo, datei)), { recursive: true })
  writeFileSync(join(repo, datei), text)
}
const commit = (zeit, text, ...dateien) => {
  for (const d of dateien) appendFileSync(join(repo, d), `# ${text}\n`)
  gitIn(zeit, 'add', '-A')
  gitIn(zeit, 'commit', '-m', text)
  return gitIn(zeit, 'rev-parse', '--short', 'HEAD').trim()
}
try {
  mkdirSync(repo)
  gitIn('2026-10-01T00:00:00Z', 'init', '-q')
  schreibe('package.json', JSON.stringify({ scripts: { 'data:alpha': 'tsx pipeline/alpha.ts', 'data:alpha-mehr': 'tsx pipeline/mehr.ts', test: 'x' } }))
  schreibe('pipeline/alpha.ts', "recordSource('alpha', 1)\n")
  schreibe('pipeline/alpha-lang.ts', "recordSource('alpha-lang', 1)\n")
  schreibe('pipeline/mehr.ts', 'recordSource(`mehr`, 1)\n')
  schreibe('pipeline/lib/helfer.ts', "export const x = 'alpha'\n")
  schreibe('.github/workflows/woche.yml', 'jobs:\n  a:\n    steps:\n      - run: npm run data:alpha -- --limit 4\n')
  schreibe('.github/workflows/mehr.yml', 'jobs:\n  a:\n    steps:\n      - run: npm run data:alpha-mehr\n')
  schreibe('.github/workflows/fremd.yml', 'jobs:\n  a:\n    steps:\n      - run: npm run test\n')
  gitIn('2026-10-01T00:00:00Z', 'add', '-A')
  gitIn('2026-10-01T00:00:00Z', 'commit', '-q', '-m', 'start')

  // Pfadzuordnung: Schreiber der Quelle plus genau die Workflows, die ihr npm-Skript starten — `alpha` nicht `alpha-lang`/`data:alpha-mehr`.
  assert.deepEqual(quellenPfade(repo, 'alpha'), ['pipeline/alpha.ts', '.github/workflows/woche.yml'])
  assert.deepEqual(quellenPfade(repo, 'mehr'), ['pipeline/mehr.ts', '.github/workflows/mehr.yml'])
  assert.deepEqual(quellenPfade(repo, 'alpha-lang'), ['pipeline/alpha-lang.ts'])
  assert.deepEqual(quellenPfade(repo, 'unbekannt'), [])
  assert.deepEqual(quellenPfade(repo, 'a.pha'), [], 'Name wörtlich, kein Regex')

  const zusatz = fixZusatz(repo)
  const eintrag = { lastOk: '2026-09-01T00:00:00Z', lastRun: '2026-10-05T12:00:00Z' }
  assert.equal(zusatz('alpha', eintrag), '', 'vorher kein Commit nach dem Lauf')

  // Fremde Dateien nach dem Lauf: kein Zusatz.
  commit('2026-10-06T12:00:00Z', 'fremd', 'pipeline/lib/helfer.ts', '.github/workflows/fremd.yml', 'pipeline/alpha-lang.ts')
  assert.equal(zusatz('alpha', eintrag), '')

  // Genau zur Zeit des Laufs: kein Zusatz; eine Sekunde danach: Zusatz mit Kurz-SHA des Commits.
  commit('2026-10-05T12:00:00Z', 'gleichzeitig', 'pipeline/alpha.ts')
  assert.equal(zusatz('alpha', eintrag), '')
  const sha1 = commit('2026-10-05T12:00:01Z', 'knapp danach', 'pipeline/alpha.ts')
  assert.equal(zusatz('alpha', eintrag), ` — Änderung an Schreiber oder Workflow gemergt 2026-10-05 (${sha1}), nächster Lauf steht aus`)

  // Neuester gewinnt; eine Workflow-Änderung (woche.yml startet auch andere Schritte) zählt nur als neutrale „Änderung“, nicht als Fix; andere Quelle bleibt unberührt.
  const sha2 = commit('2026-10-12T08:00:00Z', 'workflow', '.github/workflows/woche.yml')
  assert.equal(zusatz('alpha', eintrag), ` — Änderung an Schreiber oder Workflow gemergt 2026-10-12 (${sha2}), nächster Lauf steht aus`)
  assert.equal(zusatz('mehr', eintrag), '')
  assert.equal(commitsZuPfaden(repo, ['pipeline/alpha.ts', '.github/workflows/woche.yml'])[0].sha, sha2)

  // Ein Lauf nach dem Fix: wieder kein Zusatz (der nächste Lauf ist da).
  assert.equal(zusatz('alpha', { ...eintrag, lastRun: '2026-10-13T00:00:00Z' }), '')
  // Kein Git-Repo: kein Zusatz, kein Absturz.
  assert.equal(fixZusatz(join(wegwerf, 'nirgends'))('alpha', eintrag), '')

  // Verdrahtung: laeufe-aufraeumen als Prozess; gh ist Kulisse (wirft), git echt. Alarm bleibt, Zusatz hängt an.
  const stub = 'data:text/javascript,import cp from "node:child_process";import{syncBuiltinESMExports}from "node:module";const o=cp.execFileSync;cp.execFileSync=(c,...a)=>{if(c==="gh")throw new Error("gh?");return o(c,...a)};syncBuiltinESMExports();globalThis.fetch=async()=>new Response("{}",{status:500})'
  const aufraeumen = fileURLToPath(new URL('./laeufe-aufraeumen.mjs', import.meta.url))
  const gesundheit = join(wegwerf, 'gesundheit.json')
  writeFileSync(gesundheit, JSON.stringify({ alpha: { lastOk: '2026-01-01T00:00:00Z', lastRun: '2026-10-05T12:00:00Z' }, 'alpha-lang': { lastOk: '2026-01-01T00:00:00Z', lastRun: '2026-10-07T00:00:00Z' } }))
  const lauf = spawnSync(process.execPath, ['--import', stub, aufraeumen, '--trocken', '--gesundheit', gesundheit, '--wurzel', repo], { encoding: 'utf8', env: { ...process.env, LAUF_TOKEN: '' } })
  assert.equal(lauf.status, 0, lauf.stderr)
  assert.match(lauf.stdout, new RegExp(`^ALARM Quelle alpha seit \\d+\\.\\d Tagen ohne Erfolg \\(Frist 4 Tage, Eskalation ab 8\\) — Änderung an Schreiber oder Workflow gemergt 2026-10-12 \\(${sha2}\\), nächster Lauf steht aus$`, 'm'))
  assert.match(lauf.stdout, /^ALARM Quelle alpha-lang seit \d+\.\d Tagen ohne Erfolg \(Frist 4 Tage, Eskalation ab 8\)$/m, 'Quelle ohne neuen Commit: Alarm ohne Zusatz')
} finally {
  rmSync(wegwerf, { recursive: true, force: true })
}
console.log('wache-fix-gemergt: ok (strikte Grenze, neuester Commit, Pfadzuordnung Schreiber+Workflow, Bezugspunkt lastRun/lastOk, Gitfehler, laeufe-aufraeumen als Prozess)')
