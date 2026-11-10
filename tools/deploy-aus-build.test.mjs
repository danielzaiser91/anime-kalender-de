/**
 * Test zu `tools/deploy-aus-build.mjs` und zur Verdrahtung in `.github/workflows/deploy.yml`.
 * Aufruf: node tools/deploy-aus-build.test.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'yaml'
import { KETTEN_WORKFLOWS, baumPasst, githubUnbedenklich, waehleLauf, waehlePR } from './deploy-aus-build.mjs'

const SHA = 'a'.repeat(40)
const BAUM = 'b'.repeat(40)
const pr = (zusatz = {}) => ({ number: 7, merged_at: '2026-10-16T10:00:00Z', merge_commit_sha: SHA, base: { ref: 'main' }, head: { sha: 'c'.repeat(40) }, ...zusatz })

// PR: nur der gemergte PR mit genau diesem Squash-Commit zählt (nach Squash ist der SHA ein anderer als der Kopf).
assert.deepEqual(waehlePR([pr()], SHA), { nummer: 7, kopf: 'c'.repeat(40) })
assert.equal(waehlePR([pr({ merged_at: null })], SHA), null, 'offener PR')
assert.equal(waehlePR([pr({ merge_commit_sha: 'd'.repeat(40) })], SHA), null, 'anderer Merge-Commit')
assert.equal(waehlePR([pr({ base: { ref: 'dev' } })], SHA), null, 'anderer Zielzweig')
assert.equal(waehlePR([pr(), pr({ number: 8 })], SHA), null, 'mehrdeutig')
assert.equal(waehlePR([], SHA), null)

// Lauf: nur pull_request für den Kopf-Commit, der neueste mit grünem Sammeljob gewinnt; ein noch laufendes PR-Aussehen stört nicht.
const kopf = 'c'.repeat(40)
const REPO = 'danielzaiser91/anime-kalender-de'
const wahl = (laeufe, k, jobsVon) => waehleLauf(laeufe, k, jobsVon, REPO)
const lauf = (id, zusatz = {}) => ({ id, event: 'pull_request', head_sha: kopf, head_repository: { full_name: REPO }, ...zusatz })
const jobListe = (ergebnis, name = 'PR-Prüfkette') => [{ name: 'PR-Aussehen', conclusion: null }, { name, conclusion: ergebnis }]
const gruen = () => jobListe('success')
const nurEins = (id) => (id === 1 ? jobListe('success') : jobListe('failure'))
assert.equal(wahl([lauf(1), lauf(3), lauf(2)], kopf, gruen).id, 3)
assert.equal(wahl([lauf(1)], kopf, () => jobListe('failure')), null, 'roter Sammeljob')
assert.equal(wahl([lauf(1)], kopf, () => jobListe('cancelled')), null, 'abgebrochener Sammeljob')
assert.equal(wahl([lauf(1)], kopf, () => jobListe(null)), null, 'laufender Sammeljob')
assert.equal(wahl([lauf(1)], kopf, () => jobListe('success', 'Kette – Logik')), null, 'anderer Job grün zählt nicht')
assert.equal(wahl([lauf(1, { event: 'push' })], kopf, gruen), null, 'fremdes Ereignis')
assert.equal(wahl([lauf(1, { head_sha: 'e'.repeat(40) })], kopf, gruen), null, 'anderer Kopf-Commit')
assert.equal(wahl([lauf(5), lauf(1)], kopf, nurEins).id, 1, 'neuerer roter Lauf, älterer grüner')
assert.equal(wahl([lauf(9), lauf(8), lauf(7), lauf(1)], kopf, nurEins), null, 'nur die drei neuesten')
assert.equal(wahl([], kopf, gruen), null)
assert.equal(wahl([lauf(1, { head_repository: { full_name: 'fremd/anime-kalender-de' } })], kopf, gruen), null, 'Lauf aus einem Fork')
assert.equal(wahl([lauf(1, { head_repository: null })], kopf, gruen), null, 'Lauf ohne Repo-Angabe')

// Baum: gleicher Baum passt, jede Abweichung (auch leer, fehlend, kein JSON, falsche Länge) nicht.
assert.equal(baumPasst(JSON.stringify({ v: 'x', baum: BAUM }), BAUM), true)
assert.equal(baumPasst(JSON.stringify({ baum: 'f'.repeat(40) }), BAUM), false, 'main ist weitergewandert')
assert.equal(baumPasst(JSON.stringify({ baum: '' }), ''), false, 'leer = unbekannt, nie gleich')
assert.equal(baumPasst(JSON.stringify({ v: 'x' }), BAUM), false, 'Altbau ohne Baum')
assert.equal(baumPasst('kein json', BAUM), false)
assert.equal(baumPasst(JSON.stringify({ baum: 'kurz' }), 'kurz'), false)

// .github/: nur fremde Workflow-Dateien sind unbedenklich; je Fall steht die bedenkliche Datei zwischen zwei unbedenklichen.
const FREMD = ['.github/workflows/pr-pruefer.yml', '.github/workflows/refresh-data.yml']
const mitte = (p) => [FREMD[0], p, FREMD[1]]
assert.equal(githubUnbedenklich([]), true, 'PR ohne .github/')
assert.equal(githubUnbedenklich(FREMD), true, 'Prüfer-Agent und Sammler laufen nicht in der Kette')
assert.equal(githubUnbedenklich(['.github/workflows/weiche-test.yaml']), true, 'Endung .yaml')
assert.equal(githubUnbedenklich(mitte('.github/workflows/pr-pruefung.yml')), false, 'die Kette selbst')
assert.equal(githubUnbedenklich(mitte('.github/workflows/deploy.yml')), false, 'der Deploy (Bau-Env)')
assert.equal(githubUnbedenklich(mitte('.github/actions/kette-einrichten/action.yml')), false, 'Action der Kette')
assert.equal(githubUnbedenklich(mitte('.github/workflows/sub/x.yml')), false, 'Unterordner ist kein Workflow')
assert.equal(githubUnbedenklich(mitte('.github/CODEOWNERS')), false, 'alles Übrige zählt')
assert.equal(githubUnbedenklich(mitte('.github/workflows/x.yml.bak')), false, 'keine Workflow-Endung')
assert.equal(githubUnbedenklich(mitte('docs/.github/workflows/x.yml')), false, 'nur der Wurzelordner .github/')
assert.deepEqual(KETTEN_WORKFLOWS, ['.github/workflows/pr-pruefung.yml', '.github/workflows/deploy.yml'])
// Kette und Deploy rufen keine wiederverwendbaren Workflows und lokal nur Actions: eine andere Datei wäre sonst „fremd“ und ihre Änderung unbemerkt.
// Geparst statt per Regex, damit Anführungszeichen und Flow-Syntax nicht vorbeikommen.
/** Unzulässige `uses` eines geparsten Workflows: jedes auf Job-Ebene, lokal (`./…`) nur unter `./.github/actions/` ohne `..`. */
function unzulaessigeAufrufe(wf) {
  const schlecht = []
  for (const [id, job] of Object.entries(wf?.jobs ?? {})) {
    if (job?.uses !== undefined) schlecht.push(`${id}: ${job.uses}`)
    for (const s of job?.steps ?? []) {
      const u = String(s?.uses ?? '')
      if (u.startsWith('.') && (!u.startsWith('./.github/actions/') || u.includes('..'))) schlecht.push(`${id}: ${u}`)
    }
  }
  return schlecht
}
const yamlFall = (text) => unzulaessigeAufrufe(parse(text)).length
assert.equal(yamlFall('jobs:\n  a:\n    steps:\n      - uses: actions/checkout@v4\n      - uses: ./.github/actions/kette-einrichten\n      - run: x\n'), 0, 'Action der Kette und fremde Action sind zulässig')
assert.equal(yamlFall("jobs:\n  a:\n    steps:\n      - uses: actions/checkout@v4\n      - uses: './.github/workflows/x.yml'\n      - run: x\n"), 1, 'in Anführungszeichen')
assert.equal(yamlFall('jobs: {a: {steps: [{uses: actions/checkout@v4}, {uses: ./.github/workflows/x.yml}, {run: x}]}}'), 1, 'Flow-Syntax')
assert.equal(yamlFall('jobs:\n  a:\n    steps: [{run: x}]\n  b:\n    uses: ./.github/workflows/x.yml\n  c:\n    steps: [{run: x}]\n'), 1, 'Job-Ebene lokal')
assert.equal(yamlFall('jobs:\n  b:\n    uses: org/repo/.github/workflows/x.yml@v1\n'), 1, 'Job-Ebene fremd')
assert.equal(yamlFall('jobs:\n  a:\n    steps:\n      - uses: ./.github/actions/../workflows/x.yml\n'), 1, 'aus actions/ heraus')
assert.equal(yamlFall('jobs:\n  a:\n    steps:\n      - uses: ./tools/action\n'), 1, 'lokale Action außerhalb .github/actions/')
for (const datei of KETTEN_WORKFLOWS) {
  const wf = parse(readFileSync(resolve(import.meta.dirname, '..', datei), 'utf8'))
  assert.deepEqual(unzulaessigeAufrufe(wf), [], `${datei} ruft etwas außerhalb von .github/actions/`)
}

// Verdrahtung in deploy.yml (geparst, 10.11.2026): `build` und `pruefen` laufen parallel und prüfen die Herkunft je als ersten Schritt (Composite), kein eigener Job `herkunft`.
const wf = parse(readFileSync(resolve(import.meta.dirname, '../.github/workflows/deploy.yml'), 'utf8'))
const jobs = wf.jobs
assert.deepEqual(Object.keys(jobs), ['build', 'pruefen', 'deploy_hart', 'deploy_schlank', 'abschluss'], 'fünf Jobs, in drei Wellen: (build, pruefen) -> deploy -> abschluss')
for (const id of ['build', 'pruefen']) {
  assert.equal(jobs[id].needs, undefined, `${id} wartet auf nichts (parallel, kein Hop vorweg)`)
  assert.ok(jobs[id].if.includes("github.event.workflow_run.conclusion == 'success'"), `${id}: gescheiterter Datenlauf veröffentlicht nichts`)
  assert.ok(!jobs[id].if.includes('treffer'), `${id} entfällt bei Treffer nicht als Job, nur seine Schritte`)
  assert.deepEqual(jobs[id].permissions, { contents: 'read', actions: 'read', 'pull-requests': 'read' }, `${id}: Rechte der Herkunftsprüfung, weder pages noch id-token`)
  const checkout = jobs[id].steps.find((s) => String(s.uses).startsWith('actions/checkout'))
  assert.ok(checkout.with['fetch-depth'] >= 2, `${id}: Elterncommit für den .github-Vergleich`)
  assert.deepEqual(checkout.with['sparse-checkout'].split(String.fromCharCode(10)).filter(Boolean), ['tools', '.github/actions'], `${id}: dünner Checkout mit lokaler Aktion`)
  const herkunft = jobs[id].steps.find((s) => s.id === 'herkunft')
  assert.equal(herkunft.uses, './.github/actions/herkunft-holen', `${id}: dieselbe Herkunftsprüfung (kein kopierter Block)`)
  assert.equal(herkunft['timeout-minutes'], 5, `${id}: Frist der früheren herkunft`)
}
const aktion = parse(readFileSync(resolve(import.meta.dirname, '../.github/actions/herkunft-holen/action.yml'), 'utf8'))
const holen = aktion.runs.steps[0]
assert.equal(aktion.outputs.treffer.value, '${{ steps.holen.outputs.treffer }}')
assert.ok(holen.if.includes("!contains(github.event.head_commit.message, '[schlank]')"), 'schlanker Weg holt keinen Bau')
assert.equal(holen['continue-on-error'], true, 'Fehler beim Holen heißt nur: kein Treffer')
assert.ok(holen.run.includes('node tools/deploy-aus-build.mjs'), 'die Aktion ruft deploy-aus-build')
// Hochladen nur in build (zwei Jobs mit dem Namen github-pages wären ein Konflikt).
const hochladen = jobs.build.steps.find((s) => s.id === 'hochladen')
assert.ok(hochladen.if.includes("steps.herkunft.outputs.treffer == '1'"), 'Hochladen nur nach Treffer')
assert.equal(hochladen.with.name, 'github-pages', 'deploy-pages sucht diesen Namen')
assert.equal(hochladen['continue-on-error'], true, 'scheitert der Upload, baut der Deploy neu')
assert.equal(jobs.pruefen.steps.filter((s) => String(s.uses).startsWith('actions/upload-')).length, 0, 'pruefen lädt nichts hoch')
// Bei Treffer entfallen alle Schritte nach der Herkunftsprüfung bzw. dem Hochladen, davor läuft alles immer.
const nach = (job, id, bedingung) => {
  const s = jobs[job].steps
  const rest = s.slice(s.findIndex((x) => x.id === id) + 1).filter((x) => x.id !== 'hochladen' && x.name !== 'Melder bereitlegen')
  assert.ok(rest.length > 7, `${job}: Bau- und Prüfschritte stehen hinter ${id}`)
  for (const x of rest) assert.ok(String(x.if).includes(bedingung), `${job}: Schritt „${x.name ?? x.uses ?? x.run}“ entfällt bei Treffer`)
}
nach('build', 'hochladen', "steps.hochladen.outcome != 'success'")
nach('pruefen', 'herkunft', "steps.herkunft.outputs.treffer != '1'")
const hart = jobs.deploy_hart
assert.deepEqual([hart.needs].flat().sort(), ['build', 'pruefen'])
assert.ok(hart.if.includes("needs.build.result == 'success' && needs.pruefen.result == 'success'"), 'Bau und Prüfung grün (bei Treffer sind beide ohne Schritte grün)')
assert.ok(hart.if.includes('!cancelled()'), 'übersprungene Needs dürfen den Deploy nicht verhindern')
assert.ok(hart.if.includes("!contains(github.event.head_commit.message, '[schlank]')"), 'schlanker Commit deployt über deploy_schlank')
assert.equal(jobs.deploy_schlank.needs, 'build', 'schlank wartet nur auf den Bau')
assert.ok(jobs.abschluss.if.includes("needs.build.result != 'skipped'"), 'Abschluss hängt nicht am Deploy')
assert.deepEqual([jobs.abschluss.needs].flat().sort(), ['build', 'deploy_hart', 'deploy_schlank', 'pruefen'])
console.log('deploy-aus-build.test: ok')
