/**
 * Test zu `tools/deploy-aus-build.mjs` und zur Verdrahtung in `.github/workflows/deploy.yml`.
 * Aufruf: node tools/deploy-aus-build.test.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'yaml'
import { baumPasst, githubUnveraendert, waehleLauf, waehlePR } from './deploy-aus-build.mjs'

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
const lauf = (id, zusatz = {}) => ({ id, event: 'pull_request', head_sha: kopf, ...zusatz })
const jobListe = (ergebnis, name = 'PR-Prüfkette') => [{ name: 'PR-Aussehen', conclusion: null }, { name, conclusion: ergebnis }]
const gruen = () => jobListe('success')
const nurEins = (id) => (id === 1 ? jobListe('success') : jobListe('failure'))
assert.equal(waehleLauf([lauf(1), lauf(3), lauf(2)], kopf, gruen).id, 3)
assert.equal(waehleLauf([lauf(1)], kopf, () => jobListe('failure')), null, 'roter Sammeljob')
assert.equal(waehleLauf([lauf(1)], kopf, () => jobListe('cancelled')), null, 'abgebrochener Sammeljob')
assert.equal(waehleLauf([lauf(1)], kopf, () => jobListe(null)), null, 'laufender Sammeljob')
assert.equal(waehleLauf([lauf(1)], kopf, () => jobListe('success', 'Kette – Logik')), null, 'anderer Job grün zählt nicht')
assert.equal(waehleLauf([lauf(1, { event: 'push' })], kopf, gruen), null, 'fremdes Ereignis')
assert.equal(waehleLauf([lauf(1, { head_sha: 'e'.repeat(40) })], kopf, gruen), null, 'anderer Kopf-Commit')
assert.equal(waehleLauf([lauf(5), lauf(1)], kopf, nurEins).id, 1, 'neuerer roter Lauf, älterer grüner')
assert.equal(waehleLauf([lauf(9), lauf(8), lauf(7), lauf(1)], kopf, nurEins), null, 'nur die drei neuesten')
assert.equal(waehleLauf([], kopf, gruen), null)

// Baum: gleicher Baum passt, jede Abweichung (auch leer, fehlend, kein JSON, falsche Länge) nicht.
assert.equal(baumPasst(JSON.stringify({ v: 'x', baum: BAUM }), BAUM), true)
assert.equal(baumPasst(JSON.stringify({ baum: 'f'.repeat(40) }), BAUM), false, 'main ist weitergewandert')
assert.equal(baumPasst(JSON.stringify({ baum: '' }), ''), false, 'leer = unbekannt, nie gleich')
assert.equal(baumPasst(JSON.stringify({ v: 'x' }), BAUM), false, 'Altbau ohne Baum')
assert.equal(baumPasst('kein json', BAUM), false)
assert.equal(baumPasst(JSON.stringify({ baum: 'kurz' }), 'kurz'), false)

// .github/: unverändert nur bei gleichem, nichtleerem Baum.
assert.equal(githubUnveraendert(BAUM, BAUM), true)
assert.equal(githubUnveraendert(BAUM, 'f'.repeat(40)), false)
assert.equal(githubUnveraendert('', ''), false)

// Verdrahtung in deploy.yml: Fallback auf den Neubau bleibt, und ohne Treffer läuft alles wie vorher.
const wf = parse(readFileSync(resolve(import.meta.dirname, '../.github/workflows/deploy.yml'), 'utf8'))
const jobs = wf.jobs
assert.ok(jobs.herkunft, 'Job herkunft fehlt')
for (const id of ['build', 'pruefen']) {
  assert.ok([jobs[id].needs].flat().includes('herkunft'), `${id} wartet auf herkunft`)
  assert.match(jobs[id].if, /needs\.herkunft\.outputs\.treffer != '1'/, `${id} entfällt nur bei Treffer`)
}
const hart = jobs.deploy_hart
assert.deepEqual([hart.needs].flat().sort(), ['build', 'herkunft', 'pruefen'])
assert.match(hart.if, /needs\.herkunft\.outputs\.treffer == '1'/, 'Treffer deployt ohne Neubau')
assert.match(hart.if, /needs\.build\.result == 'success' && needs\.pruefen\.result == 'success'/, 'ohne Treffer: Bau und Prüfung grün')
assert.match(hart.if, /needs\.herkunft\.result == 'success'/, 'ohne laufenden Herkunftsjob kein Deploy')
assert.match(hart.if, /!cancelled\(\)/, 'übersprungene Needs dürfen den Deploy nicht verhindern')
assert.match(jobs.abschluss.if, /needs\.herkunft\.result != 'skipped'/, 'Abschluss hängt nicht mehr am Bau')
assert.ok([jobs.abschluss.needs].flat().includes('herkunft'))
const schritt = (id) => jobs.herkunft.steps.find((s) => s.id === id)
assert.match(schritt('holen').if, /!contains\(github\.event\.head_commit\.message, '\[schlank\]'\)/, 'schlanker Weg holt keinen Bau')
assert.equal(schritt('holen')['continue-on-error'], true, 'Fehler beim Holen heißt nur: kein Treffer')
assert.equal(jobs.herkunft.steps[0].with['fetch-depth'], 2, 'Elterncommit für den .github-Vergleich')
assert.match(schritt('hochladen').if, /steps\.holen\.outputs\.treffer == '1'/, 'Hochladen nur nach Treffer')
assert.match(jobs.herkunft.outputs.treffer, /steps\.hochladen\.outcome == 'success'/, 'Treffer erst, wenn das Artefakt liegt')
assert.equal(schritt('hochladen').with.name, 'github-pages', 'deploy-pages sucht diesen Namen')
console.log('deploy-aus-build.test: ok')
