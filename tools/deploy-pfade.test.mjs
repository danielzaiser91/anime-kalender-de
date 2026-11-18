// Test für tools/deploy-pfade.mjs und tools/deploy-veraltet.mjs (18.11.2026) samt Verdrahtung in deploy.yml.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import { bedarf, main as pfadeMain, rechne } from './deploy-pfade.mjs'
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
