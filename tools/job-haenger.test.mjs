// Hängende CI-Jobs: Grenze aus timeout-minutes (mindestens 45 min), Zeile, Abbruch + Neustart ohne Warten, Verdrahtung in laeufe-aufraeumen als Prozess.
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { grenzeMinuten, haengendeJobs, haengerWache, haengerZeile, jobTimeouts, neustartPlan } from './job-haenger.mjs'
import { spawnMitLimit } from './kind-mit-limit.mjs'

const JETZT = Date.parse('2026-11-05T17:00:00Z')
const YAML = `name: X
jobs:
  kette:
    name: Kette – Workflows
    timeout-minutes: 30
    steps:
      - run: echo
        timeout-minutes: 99
  lauf:
    runs-on: ubuntu-latest
    timeout-minutes: 330
  ohne:
    runs-on: ubuntu-latest
  dynamisch:
    timeout-minutes: \${{ fromJSON('5') }}
`
const t = jobTimeouts(YAML)
assert.deepEqual(t, { kette: 30, 'Kette – Workflows': 30, lauf: 330 })
assert.equal(grenzeMinuten(t, 'Kette – Workflows'), 45, 'unter 45 min: 45')
assert.equal(grenzeMinuten(t, 'lauf'), 330, 'Sammler: eigene Grenze')
assert.equal(grenzeMinuten(t, 'ohne'), 45)
assert.equal(grenzeMinuten(t, 'dynamisch'), 45, 'Ausdruck zählt nicht')

const minVor = (m) => new Date(JETZT - m * 60_000).toISOString()
const job = (name, minuten, status = 'in_progress', schritt = 'Run ./.github/actions/kette-einrichten') => ({
  name,
  status,
  started_at: minVor(minuten),
  steps: [
    { name: 'Set up job', status: 'completed' },
    { name: schritt, status: 'in_progress' },
  ],
})
const lauf = (id, jobs, extra = {}) => ({ id, name: 'PR-Prüfkette', path: '.github/workflows/pr-pruefung.yml@refs/pull/2935/merge', head_branch: 'refactor/x', run_attempt: 1, pull_requests: [{ number: 2935 }], jobs, ...extra })
const finde = (laeufe) => haengendeJobs(laeufe, () => t, JETZT)

// Grenze genau 45 min: kein Treffer, 46: Treffer.
assert.equal(finde([lauf(1, [job('Kette – Workflows', 45)])]).length, 0)
const h = finde([lauf(1, [job('Kette – Workflows', 46)])])
assert.equal(h.length, 1)
assert.equal(
  haengerZeile(h[0]),
  'HÄNGER Lauf 1 PR-Prüfkette / Kette – Workflows — Schritt „Run ./.github/actions/kette-einrichten“ seit 46 min (Grenze 45 min), PR 2935',
)
// Sammler mit 330 min: bei 200 min kein Treffer, bei 331 Treffer mit eigener Grenze; ohne PR steht der Zweig.
assert.equal(finde([lauf(2, [job('lauf', 200)])]).length, 0)
const sammler = finde([lauf(2, [job('lauf', 331)], { pull_requests: [] })])
assert.equal(sammler[0].grenze, 330)
assert.equal(sammler[0].bezug, 'refactor/x')
// Wartende oder fertige Jobs und Jobs ohne Start zählen nicht; ein Job ohne aktiven Schritt nennt das.
assert.equal(finde([lauf(3, [job('Kette – Workflows', 500, 'queued'), job('Kette – Workflows', 500, 'completed'), { name: 'Kette – Workflows', status: 'in_progress' }])]).length, 0)
assert.equal(finde([lauf(4, [{ name: 'Kette – Workflows', status: 'in_progress', started_at: minVor(60), steps: [] }])])[0].schritt, '(kein Schritt aktiv)')
// Zwei Jobs im selben Lauf: nur der hängende.
assert.deepEqual(finde([lauf(5, [job('Kette – Workflows', 10), job('Kette – Workflows', 90)])]).map((x) => x.minuten), [90])

// Neustartplan: nur abgeschlossene Läufe; Lauf in Abbruch bleibt.
assert.deepEqual(neustartPlan({ 7: {}, 8: {}, 9: {} }, { 7: 'completed', 8: 'in_progress' }), ['7'])

// Wache mit gh-Attrappe: trocken ändert nichts, sonst Abbruch, beim nächsten Aufruf Neustart (zwei Läufe hintereinander).
const wegwerf = mkdtempSync(join(tmpdir(), 'job-haenger-'))
try {
  const wurzel = join(wegwerf, 'repo')
  const merk = join(wegwerf, 'merk.json')
  const status = { 11: 'in_progress' }
  const aufrufe = []
  const gh = (a) => {
    aufrufe.push(a.join(' '))
    if (a[1].includes('/runs?status=in_progress')) {
      return JSON.stringify({ workflow_runs: [{ ...lauf(11, undefined), jobs: undefined }, { ...lauf(12, undefined, { run_attempt: 3 }), jobs: undefined }] })
    }
    if (a[1].endsWith('/runs/11/jobs?per_page=100') || a[1].endsWith('/runs/12/jobs?per_page=100')) return JSON.stringify({ jobs: [job('Kette – Workflows', 90)] })
    if (a[1].endsWith('/runs/11')) return JSON.stringify({ status: status[11] })
    if (a[0] === 'run') return ''
    throw new Error(`unerwartet ${a.join(' ')}`)
  }
  const schreibend = () => aufrufe.filter((x) => x.startsWith('run '))
  // Datei fehlt: Grenze 45; das Workflow-File liegt im Wegwerf-Repo.
  const trocken = haengerWache(gh, 'o/r', wurzel, JETZT, merk, { trocken: true })
  assert.equal(trocken.filter((z) => z.startsWith('HÄNGER Lauf')).length, 2)
  assert.deepEqual(schreibend(), [], 'trocken schreibt nichts')
  const eins = haengerWache(gh, 'o/r', wurzel, JETZT, merk)
  assert.deepEqual(schreibend(), ['run cancel 11 --repo o/r'], 'Lauf 12 hat Versuch 3: kein Abbruch')
  assert.ok(eins.some((z) => z.includes('Lauf 12: Versuch 3, kein Neustart mehr')))
  assert.deepEqual(JSON.parse(readFileSync(merk, 'utf8')), { 11: { versuch: 1 } })
  // Zweiter Aufruf, Abbruch noch nicht durch: kein zweiter Abbruch, kein Neustart.
  haengerWache(gh, 'o/r', wurzel, JETZT, merk)
  assert.deepEqual(schreibend(), ['run cancel 11 --repo o/r'])
  // Dritter Aufruf, Lauf abgeschlossen: --failed, Merkdatei leer.
  status[11] = 'completed'
  const drei = haengerWache(gh, 'o/r', wurzel, JETZT, merk)
  assert.deepEqual(schreibend(), ['run cancel 11 --repo o/r', 'run rerun 11 --failed --repo o/r'])
  assert.ok(drei.some((z) => z.includes('Lauf 11: mit --failed neu gestartet')))
  assert.deepEqual(JSON.parse(readFileSync(merk, 'utf8')), {})
  // Lesefehler ist eine Zeile.
  const fehl = haengerWache(() => { throw new Error('netz\nweiter') }, 'o/r', wurzel, JETZT, merk)
  assert.deepEqual(fehl, ['HÄNGER? Jobs nicht lesbar: netz'])

  // Verdrahtung: der echte Aufrufer (laeufe-aufraeumen) fährt die Wache; gh/Worker über eine Kulisse, Start 2026-11-01 weit zurück.
  const kulisse = join(wegwerf, 'kulisse.mjs')
  const szenario = join(wegwerf, 'szenario.json')
  const log = join(wegwerf, 'log.txt')
  writeFileSync(szenario, JSON.stringify({ jobs: [{ name: 'Kette – Workflows', status: 'in_progress', started_at: '2026-11-01T15:14:00Z', steps: [{ name: 'Run ./.github/actions/kette-einrichten', status: 'in_progress' }] }] }))
  writeFileSync(
    kulisse,
    `import cp from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
cp.execFileSync = (c, a) => {
  appendFileSync(${JSON.stringify(log)}, c + ' ' + a.join(' ') + '\\n')
  const s = JSON.parse(readFileSync(${JSON.stringify(szenario)}, 'utf8'))
  const url = a[1] ?? ''
  if (c === 'gh' && url.includes('/runs?status=in_progress')) return JSON.stringify({ workflow_runs: [{ id: 42, name: 'PR-Prüfkette', path: '.github/workflows/pr-pruefung.yml@refs/pull/9/merge', head_branch: 'x', run_attempt: 1, pull_requests: [{ number: 9 }] }] })
  if (c === 'gh' && url.endsWith('/runs/42/jobs?per_page=100')) return JSON.stringify({ jobs: s.jobs })
  if (c === 'gh' && url.endsWith('/runs/42')) return JSON.stringify({ status: 'in_progress' })
  return '[]'
}
syncBuiltinESMExports()
globalThis.fetch = async () => new Response('{}', { status: 500 })
`,
  )
  const aufraeumen = fileURLToPath(new URL('./laeufe-aufraeumen.mjs', import.meta.url))
  const leereGesundheit = join(wegwerf, 'g.json')
  writeFileSync(leereGesundheit, '{}')
  const fahre = (...zusatz) => {
    const r = spawnMitLimit(process.execPath, ['--import', `file:///${kulisse.replace(/\\/g, '/')}`, aufraeumen, ...zusatz, '--gesundheit', leereGesundheit, '--haenger-speicher', join(wegwerf, 'p-merk.json')], { encoding: 'utf8', env: { ...process.env, LAUF_TOKEN: '' } })
    return r
  }
  const p1 = fahre('--trocken')
  assert.equal(p1.status, 0, p1.stderr)
  assert.match(p1.stdout, /^HÄNGER Lauf 42 PR-Prüfkette \/ Kette – Workflows — Schritt „Run \.\/\.github\/actions\/kette-einrichten“ seit \d+ min \(Grenze 45 min\), PR 9$/m)
  assert.doesNotMatch(readFileSync(log, 'utf8'), /run cancel/)
  fahre()
  assert.match(readFileSync(log, 'utf8'), /^gh run cancel 42 --repo danielzaiser91\/anime-kalender-de$/m)
} finally {
  rmSync(wegwerf, { recursive: true, force: true })
}
console.log('job-haenger: ok (Grenze 45/46 min, timeout-minutes, Zeile, Abbruch, Neustart beim nächsten Aufruf, Versuch 3, Lesefehler, laeufe-aufraeumen als Prozess)')
