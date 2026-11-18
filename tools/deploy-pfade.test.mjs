// Test für tools/deploy-pfade.mjs und tools/deploy-veraltet.mjs (18.11.2026) samt Verdrahtung in deploy.yml.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import { bedarf, macheEcht, main as pfadeMain, rechne } from './deploy-pfade.mjs'
import { LAEUFE_HOECHSTENS, main as veraltetMain, pruefe, ueberholer } from './deploy-veraltet.mjs'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')

// 1. Bedarf je Pfad
assert.deepEqual(bedarf(['public/data/titles.json', 'public/data/news.json']), { workflows: false, extension: false, logik: false }, 'nur Datenpfade: nichts nötig')
assert.deepEqual(bedarf(['web/src/App.tsx']), { workflows: true, extension: false, logik: true }, 'Web-Code: Workflows und Logik, nicht die Erweiterung')
assert.equal(bedarf(['extension/amazon.js']).extension, true, 'extension/ weckt die Erweiterungsprüfung')
assert.equal(bedarf(['tools/pr-stufe.mjs']).extension, true, 'tools/ weckt sie ebenfalls (die Prüfskripte liegen dort)')
assert.equal(bedarf(['package-lock.json']).extension, true, 'Paketdatei weckt sie')
assert.equal(bedarf(['public/data/pruefliste-stand.json']).extension, true, 'Prüflisten-Stand liest eine Erweiterungsprüfung')
assert.equal(bedarf(['public/data/titles.json']).extension, false, 'andere Bestandsdateien nicht')
assert.deepEqual(bedarf([]), { workflows: false, extension: false, logik: false }, 'leere Änderung: nichts')
assert.equal(bedarf(['.github/workflows/deploy.yml']).workflows, true, 'Workflow-Datei weckt check:workflows')

// 2. rechne: Fehler heißen alles
const alles = { workflows: true, extension: true, logik: true }
const ok = (dateien) => ({ letzterGruenerStand: () => 'a'.repeat(40), geaendert: () => dateien })
assert.deepEqual({ ...rechne({}, ok(['public/data/titles.json'])), grund: 0 }, { workflows: false, extension: false, logik: false, grund: 0 })
assert.deepEqual({ ...rechne({}, { letzterGruenerStand: () => undefined, geaendert: () => [] }), grund: 0 }, { ...alles, grund: 0 }, 'kein grüner Lauf: alles')
assert.deepEqual({ ...rechne({}, { letzterGruenerStand: () => { throw new Error('gh kaputt') }, geaendert: () => [] }), grund: 0 }, { ...alles, grund: 0 }, 'gh kaputt: alles')
assert.deepEqual({ ...rechne({}, { letzterGruenerStand: () => 'b', geaendert: () => { throw new Error('Commit fehlt') } }), grund: 0 }, { ...alles, grund: 0 }, 'Basis nicht lesbar: alles')
assert.deepEqual({ ...rechne({}, ok(['a\nb'])), grund: 0 }, { ...alles, grund: 0 }, 'Pfad mit Zeilenumbruch: alles')

// 2b. ECHT fragt nur erfolgreiche Läufe von main ab (Prüfer 4227 A2: ohne status=success blieb der Test grün)
{
  const aufrufe = []
  const echt = macheEcht((befehl, args) => (aufrufe.push([befehl, ...args]), JSON.stringify({ workflow_runs: [{ head_sha: 'c'.repeat(40) }] })))
  assert.equal(echt.letzterGruenerStand('o/r'), 'c'.repeat(40))
  const url = aufrufe[0].find((a) => a.includes('/runs?'))
  assert.ok(aufrufe[0][0] === 'gh' && url.includes('workflows/deploy.yml/runs?') && url.includes('branch=main') && url.includes('status=success') && url.includes('per_page=1'), `Abfrage: ${url}`)
}

// 3. main schreibt die Ausgabe
{
  let datei = ''
  pfadeMain({ GITHUB_OUTPUT: 'x' }, () => {}, ok(['extension/a.js']), (_, text) => { datei += text })
  assert.equal(datei, 'workflows=1\nextension=1\nlogik=1\n')
  datei = ''
  pfadeMain({ GITHUB_OUTPUT: 'x' }, () => {}, ok(['public/data/a.json']), (_, text) => { datei += text })
  assert.equal(datei, 'workflows=0\nextension=0\nlogik=0\n')
}

// 4. Überholer: der neuere gewinnt
const lauf = (nr, sha, status = 'completed') => ({ id: 1000 + nr, run_number: nr, head_sha: sha, status })
const grün = [{ name: 'deploy_hart', conclusion: 'success' }]
const rot = [{ name: 'deploy_hart', conclusion: 'failure' }, { name: 'abschluss', conclusion: 'success' }]
const eigener = lauf(10, 'alt')
const jobs = (tabelle) => (id) => tabelle[id] ?? []
const voraus = (menge) => (meiner, ihrer) => menge.includes(`${meiner}>${ihrer}`)
assert.equal(ueberholer({ eigener, laeufe: [lauf(11, 'neu')], jobsVon: jobs({ 1011: grün }), vorausVon: voraus(['alt>neu']) })?.run_number, 11, 'neuerer Lauf deployt schon, Stand voraus: veraltet')
assert.equal(ueberholer({ eigener, laeufe: [lauf(11, 'neu')], jobsVon: jobs({ 1011: rot }), vorausVon: voraus(['alt>neu']) }), null, 'neuerer Deploy rot: wir deployen')
assert.equal(ueberholer({ eigener, laeufe: [lauf(11, 'neu')], jobsVon: jobs({}), vorausVon: voraus(['alt>neu']) }), null, 'neuerer Lauf noch ohne Deploy: wir deployen (er folgt uns in der Gruppe)')
assert.equal(ueberholer({ eigener, laeufe: [lauf(11, 'quer')], jobsVon: jobs({ 1011: grün }), vorausVon: voraus([]) }), null, 'Stand nicht voraus (gleich, hinter, getrennt): deployen')
assert.equal(ueberholer({ eigener, laeufe: [lauf(9, 'aelter')], jobsVon: jobs({ 1009: grün }), vorausVon: voraus(['alt>aelter']) }), null, 'ältere Läufe zählen nie')
assert.equal(ueberholer({ eigener, laeufe: [lauf(11, 'neu', 'queued')], jobsVon: jobs({ 1011: grün }), vorausVon: voraus(['alt>neu']) }), null, 'wartender Lauf zählt nicht')
// A1 (Prüfer 4227): B (neu, schnell) wartet hinter C, A (alt, langsam) ersetzt B, B endet cancelled. A darf nicht den alten Stand deployen, sondern stößt main an.
const ersetzt = [{ name: 'deploy_hart', conclusion: 'cancelled' }, { name: 'abschluss', conclusion: 'skipped' }]
assert.deepEqual(
  (({ run_number, art }) => ({ run_number, art }))(ueberholer({ eigener, laeufe: [lauf(11, 'neu')], jobsVon: jobs({ 1011: ersetzt }), vorausVon: voraus(['alt>neu']) })),
  { run_number: 11, art: 'ersetzt' },
  'neuerer Deploy-Job cancelled, Stand voraus: ersetzt',
)
assert.equal(ueberholer({ eigener, laeufe: [lauf(11, 'quer')], jobsVon: jobs({ 1011: ersetzt }), vorausVon: voraus([]) }), null, 'ersetzter Lauf mit Stand nicht voraus: normal deployen')
assert.equal(ueberholer({ eigener, laeufe: [lauf(11, 'neu'), lauf(12, 'neuer')], jobsVon: jobs({ 1011: ersetzt, 1012: grün }), vorausVon: voraus(['alt>neu', 'alt>neuer']) }).art, 'ausgeliefert', 'noch neuerer grüner Lauf zählt vor dem ersetzten: kein Anstoß')
assert.equal(ueberholer({ eigener, laeufe: [lauf(11, 'neu'), lauf(12, 'neuer')], jobsVon: jobs({ 1011: grün, 1012: ersetzt }), vorausVon: voraus(['alt>neu', 'alt>neuer']) }).art, 'ersetzt', 'der neueste ersetzte Lauf wartet noch auf seinen Deploy: Anstoß')
{
  const api = (pfad) => {
    if (pfad.endsWith('/runs/7')) return eigener
    if (pfad.includes('/workflows/deploy.yml/runs')) return { workflow_runs: [lauf(11, 'neu')] }
    if (pfad.endsWith('/runs/1011/jobs?per_page=100')) return { jobs: ersetzt }
    if (pfad.includes('/compare/alt...neu')) return { status: 'ahead' }
    throw new Error(`unerwartet ${pfad}`)
  }
  const env = { GITHUB_REPOSITORY: 'o/r', GITHUB_RUN_ID: '7', GITHUB_OUTPUT: 'x' }
  let datei = ''
  const angestossen = []
  assert.equal(veraltetMain(env, () => {}, { api, anstossen: (r) => angestossen.push(r) }, (_, t) => { datei += t }), 0)
  assert.deepEqual([datei, angestossen], ['veraltet=1\n', ['o/r']], 'A deployt nicht und stößt genau einen Deploy-Lauf für main an')
  const meldungen = []
  assert.equal(veraltetMain(env, (t) => meldungen.push(t), { api, anstossen: () => { throw new Error('403') } }, () => {}), 1, 'Anstoß scheitert: Schritt rot, nie still grün')
  assert.ok(meldungen.some((t) => t.startsWith('::error::')))
  const grünApi = (pfad) => (pfad.endsWith('/runs/1011/jobs?per_page=100') ? { jobs: grün } : api(pfad))
  const nie = []
  assert.equal(veraltetMain(env, () => {}, { api: grünApi, anstossen: (r) => nie.push(r) }, () => {}), 0)
  assert.deepEqual(nie, [], 'neuerer Lauf schon ausgeliefert: kein Anstoß')
}
{
  const viele = Array.from({ length: LAEUFE_HOECHSTENS + 3 }, (_, i) => lauf(11 + i, `s${i}`))
  const gefragt = []
  ueberholer({ eigener, laeufe: viele, jobsVon: (id) => (gefragt.push(id), []), vorausVon: () => false })
  assert.equal(gefragt.length, LAEUFE_HOECHSTENS, 'höchstens so viele Läufe werden gefragt')
}

// 5. pruefe: Fehler heißen deployen
{
  const api = (pfad) => {
    if (pfad.endsWith('/runs/7')) return eigener
    if (pfad.includes('/workflows/deploy.yml/runs')) return { workflow_runs: [lauf(11, 'neu')] }
    if (pfad.endsWith('/runs/1011/jobs?per_page=100')) return { jobs: grün }
    if (pfad.includes('/compare/alt...neu')) return { status: 'ahead' }
    throw new Error(`unerwartet ${pfad}`)
  }
  assert.equal(pruefe({ GITHUB_REPOSITORY: 'o/r', GITHUB_RUN_ID: '7' }, { api }).veraltet, true)
  assert.equal(pruefe({ GITHUB_REPOSITORY: 'o/r', GITHUB_RUN_ID: '7' }, { api: () => { throw new Error('403') } }).veraltet, false, 'API-Fehler: deployen')
  let datei = ''
  veraltetMain({ GITHUB_REPOSITORY: 'o/r', GITHUB_RUN_ID: '7', GITHUB_OUTPUT: 'x' }, () => {}, { api }, (_, t) => { datei += t })
  assert.equal(datei, 'veraltet=1\n')
  datei = ''
  veraltetMain({ GITHUB_REPOSITORY: 'o/r', GITHUB_RUN_ID: '7', GITHUB_OUTPUT: 'x' }, () => {}, { api: () => { throw new Error('x') } }, (_, t) => { datei += t })
  assert.equal(datei, '', 'bei Fehler keine Ausgabe, der Deploy-Schritt läuft')
}

// 6. Verdrahtung in deploy.yml
{
  const deploy = yaml.load(readFileSync(join(wurzel, '.github/workflows/deploy.yml'), 'utf8'))
  assert.equal(deploy.concurrency, undefined, 'keine Gruppe am ganzen Lauf: abschluss und Prüfjobs blockieren keinen folgenden Lauf')
  const gruppen = {}
  for (const [id, job] of Object.entries(deploy.jobs)) if (job.concurrency) gruppen[id] = job.concurrency
  assert.deepEqual(Object.keys(gruppen).sort(), ['deploy_hart', 'deploy_schlank'], 'die Gruppe hängt genau an den beiden Deploy-Jobs')
  assert.equal(gruppen.deploy_hart.group, gruppen.deploy_schlank.group, 'beide Deploy-Jobs teilen dieselbe Gruppe (sonst deployten sie gleichzeitig)')
  assert.equal(gruppen.deploy_hart['cancel-in-progress'], false, 'kein Abbruch eines laufenden Deploys')
  for (const text of ['app-push-{0}', 'uebersprungen-{0}', ": 'pages'"].map((t) => t.replace(': ', ''))) assert.ok(gruppen.deploy_hart.group.includes(text), `Gruppenlogik erhalten: ${text}`)
  for (const id of ['deploy_hart', 'deploy_schlank']) {
    const schritte = deploy.jobs[id].steps
    const veraltet = schritte.find((s) => s.id === 'veraltet')
    assert.equal(veraltet.run, 'node tools/deploy-veraltet.mjs', `${id}: Veraltet-Prüfung`)
    assert.equal(schritte.find((s) => s.id === 'deployment').if, "${{ steps.veraltet.outputs.veraltet != '1' }}", `${id}: Deploy entfällt, wenn ein neuerer schon ausgeliefert hat`)
    assert.ok(schritte.indexOf(veraltet) < schritte.findIndex((s) => s.id === 'deployment'), `${id}: Prüfung vor dem Deploy`)
  }
  for (const id of ['deploy_hart', 'deploy_schlank']) assert.equal(deploy.jobs[id].permissions.actions, 'write', `${id}: Recht für den Anstoß eines Deploy-Laufs (gh workflow run)`)
  const paths = deploy.on.push['paths-ignore']
  for (const p of ['.claude/**', 'daniel-zum-abarbeiten/**']) assert.ok(paths.includes(p), `paths-ignore: ${p}`)
  const pruefen = deploy.jobs.pruefen.steps
  const ext = pruefen.find((s) => s.run === 'npm run check:extension')
  assert.ok(ext.if.includes("steps.pfade.outputs.extension != '0'"), 'check:extension nur bei berührten Pfaden (fehlende Ausgabe heißt: läuft)')
  const wf = pruefen.find((s) => s.run === 'npm run check:workflows')
  assert.ok(wf.if.includes("steps.pfade.outputs.workflows != '0'") && wf.if.includes("steps.wbeleg.outputs.gueltig != '1'"), 'check:workflows nur bei berührten Pfaden und ohne Beleg')
  const zus = deploy.jobs.zusicherungen.steps.find((s) => s.name === 'Zusicherungen prüfen')
  assert.ok(zus.run.includes('check:pfade') && zus.run.includes('check:search'), 'die Datenzusicherungen bleiben vor dem Deploy')
}
console.log('deploy-pfade: grün.')
