/**
 * Test zu .github/workflows/zug-fahrt.yml: Form, Bedingung des Jobs als Wertetabelle, die Shell-Verzweigung des Schritts „Fahrt“ ausgeführt (mit `echo`
 * statt `node`) und jeder entstehende Aufruf gegen `main` aus tools/zug-fahrt.mjs gehalten. Erwartete Werte stehen fest hier.
 * Aufruf: node tools/zug-fahrt-workflow.test.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'yaml'
import { main } from './zug-fahrt.mjs'

const WURZEL = resolve(import.meta.dirname, '..')
const text = readFileSync(resolve(WURZEL, '.github/workflows/zug-fahrt.yml'), 'utf8')
const doc = parse(text)
const job = doc.jobs.fahrt
const schritte = job.steps
let faelle = 0
const fall = (name, fn) => {
  fn()
  faelle++
  console.log(`  ✓ ${name}`)
}

fall('nur diese Auslöser: workflow_run der Prüfkette auf zug-fahrt/zug-probe und workflow_dispatch', () => {
  const an = doc.on
  assert.deepEqual(Object.keys(an).sort(), ['workflow_dispatch', 'workflow_run'])
  assert.deepEqual(an.workflow_run, { workflows: ['PR-Prüfkette'], types: ['completed'], branches: ['zug-fahrt', 'zug-probe'] })
  assert.deepEqual(an.workflow_dispatch.inputs.modus.options, ['start', 'bau-deploy', 'urteil'])
  assert.equal(an.workflow_dispatch.inputs.trocken.default, true, 'Standard von Hand ist trocken')
  assert.equal(an.workflow_dispatch.inputs.schieben.default, false, 'Schieben ist standardmäßig aus')
  assert.equal(an.workflow_dispatch.inputs.schieben.type, 'boolean')
  assert.deepEqual(Object.keys(an.workflow_dispatch.inputs).sort(), ['lauf', 'modus', 'schieben', 'trocken'])
})
fall('ein Job, kein Lauf bricht einen anderen ab, Frist unter 10 Minuten, Rechte knapp', () => {
  assert.deepEqual(Object.keys(doc.jobs), ['fahrt'])
  assert.deepEqual(doc.concurrency, { group: 'zug-fahrt', 'cancel-in-progress': false })
  assert.ok(job['timeout-minutes'] <= 10)
  assert.deepEqual(doc.permissions, { contents: 'read' })
  assert.deepEqual(job.permissions, { contents: 'read', 'pull-requests': 'write', actions: 'write' })
})
fall('Schritte in fester Reihenfolge; das App-Token sieht nur der Checkout (fetch-depth gibt es dort nicht: Verlauf holt der nächste Schritt)', () => {
  assert.deepEqual(schritte.map((s) => s.name ?? s.uses), ['App-Token holen', 'actions/checkout@v4', 'Verlauf holen und Kennung setzen', 'Fahrt'])
  assert.deepEqual(schritte[1].with, { token: '${{ steps.app.outputs.token }}' })
  assert.equal(text.split('steps.app.outputs.token').length - 1, 1, 'genau eine Nennung des App-Tokens')
  assert.match(schritte[2].run, /git fetch --quiet --unshallow origin/)
})
fall('Schritt Fahrt: env genau diese acht, GH_TOKEN ist das Workflow-Token, kein Ausdruck im Skripttext', () => {
  assert.deepEqual(schritte[3].env, {
    GH_TOKEN: '${{ github.token }}',
    EREIGNIS: '${{ github.event_name }}',
    MODUS: '${{ inputs.modus }}',
    TROCKEN: '${{ inputs.trocken }}',
    KETTENLAUF: '${{ inputs.lauf }}',
    SCHIEBEN: '${{ inputs.schieben }}',
    ZWEIG: '${{ github.event.workflow_run.head_branch }}',
    LAUF: '${{ github.event.workflow_run.id }}',
  })
  for (const s of schritte) if (s.run) assert.ok(!s.run.includes('${{'), `Ausdruck im run von ${s.name}`)
})
fall('das Werkzeug, das der Schritt aufruft, gibt es', () => assert.ok(existsSync(resolve(WURZEL, 'tools/zug-fahrt.mjs'))))

console.log('Bedingung des Jobs (Ausdruck als JavaScript ausgewertet, Wertetabelle)')
const bedingung = String(job.if).replace(/\s+/g, ' ')
const wert = (github) => new Function('github', `return (${bedingung})`)(github)
const lauf = (extra = {}) => ({ event_name: 'workflow_run', repository: 'o/r', event: { workflow_run: { event: 'pull_request', head_repository: { full_name: 'o/r' }, head_branch: 'zug-fahrt', ...extra } } })
const TABELLE = [
  ['workflow_dispatch', { event_name: 'workflow_dispatch', repository: 'o/r', event: { workflow_run: {} } }, true],
  ['Kette auf zug-fahrt', lauf(), true],
  ['Kette auf zug-probe', lauf({ head_branch: 'zug-probe' }), true],
  ['Kette auf main', lauf({ head_branch: 'main' }), false],
  ['Kette auf zug (Unter-PR)', lauf({ head_branch: 'zug' }), false],
  ['Zweig mit Anhang zug-fahrt2', lauf({ head_branch: 'zug-fahrt2' }), false],
  ['Fork-PR mit Zweig zug-fahrt', lauf({ head_repository: { full_name: 'x/r' } }), false],
  ['Kette lief für einen push, nicht für einen PR', lauf({ event: 'push' }), false],
]
for (const [name, github, soll] of TABELLE) fall(`${name} → ${soll}`, () => assert.equal(wert(github), soll))

console.log('Schritt Fahrt: Shell-Verzweigung mit echo statt node')
const run = schritte[3].run
const aufrufe = (env) => {
  const r = spawnSync('bash', ['-c', run.replaceAll('node tools/zug-fahrt.mjs', 'echo ZUG')], { env: { ...process.env, ...env }, encoding: 'utf8', timeout: 30000 })
  assert.equal(r.status, 0, r.stderr)
  return r.stdout.trim().split('\n')
}
assert.equal(run.split('node tools/zug-fahrt.mjs').length - 1, 4, 'vier Aufrufe: urteil (Kette), urteil (Hand), trocken, echt')
assert.equal(run.split('--schieben').length - 1, 1, '--schieben steht genau einmal, im Hand-Urteil')
const VOR = { EREIGNIS: 'workflow_dispatch', MODUS: 'start', TROCKEN: 'true', SCHIEBEN: 'false', KETTENLAUF: '', ZWEIG: '', LAUF: '' }
const SCHRITT = [
  ['workflow_run → urteil mit Zweig und Lauf', { ...VOR, EREIGNIS: 'workflow_run', MODUS: '', TROCKEN: '', ZWEIG: 'zug-probe', LAUF: '123' }, ['ZUG urteil --zweig zug-probe --lauf 123']],
  ['workflow_run schiebt nie, auch wenn SCHIEBEN gesetzt wäre', { ...VOR, EREIGNIS: 'workflow_run', MODUS: '', TROCKEN: 'false', SCHIEBEN: 'true', ZWEIG: 'zug-fahrt', LAUF: '55' }, ['ZUG urteil --zweig zug-fahrt --lauf 55']],
  ['Hand, urteil, Standard (trocken, nicht schieben)', { ...VOR, MODUS: 'urteil', KETTENLAUF: '77' }, ['ZUG urteil --zweig zug-fahrt --lauf 77 --trocken']],
  ['Hand, urteil, trocken und schieben → bleibt trocken, --schieben wird weitergereicht (der Dry-Run entscheidet im Werkzeug)', { ...VOR, MODUS: 'urteil', KETTENLAUF: '77', SCHIEBEN: 'true' }, ['ZUG urteil --zweig zug-fahrt --lauf 77 --trocken --schieben']],
  ['Hand, urteil, nicht trocken, nicht schieben', { ...VOR, MODUS: 'urteil', KETTENLAUF: '77', TROCKEN: 'false' }, ['ZUG urteil --zweig zug-fahrt --lauf 77']],
  ['Hand, urteil, nicht trocken, schieben', { ...VOR, MODUS: 'urteil', KETTENLAUF: '77', TROCKEN: 'false', SCHIEBEN: 'true' }, ['ZUG urteil --zweig zug-fahrt --lauf 77 --schieben']],
  ['Hand, start mit gesetztem SCHIEBEN: kein --schieben', { ...VOR, TROCKEN: 'false', SCHIEBEN: 'true' }, ['ZUG start']],
  ['Hand, start, trocken', VOR, ['ZUG start --trocken']],
  ['Hand, start, echt', { ...VOR, TROCKEN: 'false' }, ['ZUG start']],
  ['Hand, bau-deploy, trocken', { ...VOR, MODUS: 'bau-deploy' }, ['ZUG bau-deploy --trocken']],
  ['Hand, bau-deploy, echt', { ...VOR, MODUS: 'bau-deploy', TROCKEN: 'false' }, ['ZUG bau-deploy']],
]
for (const [name, env, soll] of SCHRITT) fall(name, () => assert.deepEqual(aufrufe(env), soll))

console.log('jeder Aufruf des Schritts ist für main() ein gültiger Aufruf (Exit 0, kein Aufruf-Fehler)')
const kulisse = {
  gh: (a) => {
    if (a[0] === 'run' && a[1] === 'view') return JSON.stringify({ databaseId: 123, headSha: 'a'.repeat(40), status: 'in_progress', conclusion: '' })
    if (a[0] === 'pr' && a[1] === 'list') return '[]'
    throw new Error(`Attrappe kennt nicht: ${a.join(' ')}`)
  },
  git: () => '', // ls-remote ohne Treffer: Zweig zug fehlt
}
for (const [name, args] of [['urteil', ['urteil', '--zweig', 'zug-probe', '--lauf', '123']], ['start --trocken', ['start', '--trocken']], ['start', ['start']], ['bau-deploy --trocken', ['bau-deploy', '--trocken']], ['urteil von Hand --trocken --schieben', ['urteil', '--zweig', 'zug-fahrt', '--lauf', '123', '--trocken', '--schieben']]]) {
  fall(`main(${name}) → 0`, () => {
    const zeilen = []
    assert.equal(main(args, { ...kulisse, melde: (z) => zeilen.push(z) }), 0, zeilen.join('\n'))
    assert.ok(!zeilen.some((z) => /Aufruf:|FEHLER/.test(z)), zeilen.join('\n'))
  })
}

console.log(`zug-fahrt-workflow.test: ${faelle} Fälle grün`)
