/**
 * Test zu `holeBau` in `tools/deploy-aus-build.mjs` mit Kulissen-Werkzeug (kein git, gh, tar): jede Beweisweiche hat einen Fall,
 * der ohne sie einen Treffer meldete. Aufruf: node tools/deploy-aus-build-holen.test.mjs
 */
import assert from 'node:assert/strict'
import { holeBau } from './deploy-aus-build.mjs'

const REPO = 'o/r'
const SHA = 'a'.repeat(40)
const KOPF = 'c'.repeat(40)
const BAUM = 'b'.repeat(40)
const GH = 'd'.repeat(40)

/** Kulisse eines Treffers; `zusatz` überschreibt einzelne Antworten. Unbekannte git-Aufrufe werfen wie ein fehlender Elterncommit. */
function kulisse(zusatz = {}) {
  const aufrufe = { kopiert: [], api: [], git: [], geladen: [] }
  const antworten = {
    'rev-parse HEAD^{tree}': BAUM,
    'rev-parse HEAD:.github': GH,
    'rev-parse HEAD~1:.github': GH,
    ...zusatz.git,
  }
  const pr = { number: 7, merged_at: 'x', merge_commit_sha: SHA, base: { ref: 'main' }, head: { sha: KOPF } }
  const lauf = { id: 5, event: 'pull_request', head_sha: KOPF, head_repository: { full_name: REPO } }
  const w = {
    git: (args) => {
      aufrufe.git.push(args.join(' '))
      const antwort = antworten[args.join(' ')]
      if (antwort === undefined) throw new Error('git: unbekannt')
      return antwort
    },
    api: (pfad) => {
      aufrufe.api.push(pfad)
      if (pfad.includes('/commits/')) return zusatz.prs ?? [pr]
      if (pfad.includes('/workflows/')) return { workflow_runs: zusatz.laeufe ?? [lauf] }
      return { jobs: zusatz.jobs ?? [{ name: 'PR-Prüfkette', conclusion: 'success' }] }
    },
    laden: zusatz.laden ?? ((repo, id) => { aufrufe.geladen.push([repo, id]); return '/tmp/artifact.tar' }),
    version: () => zusatz.version ?? JSON.stringify({ v: 'x', baum: BAUM }),
    kopieren: (von, nach) => aufrufe.kopiert.push([von, nach]),
  }
  return { w, aufrufe }
}

const lauf = (zusatz) => {
  const { w, aufrufe } = kulisse(zusatz)
  return { ergebnis: holeBau({ repo: REPO, sha: SHA, ziel: 'z.tar' }, w), aufrufe }
}

const treffer = lauf()
assert.equal(treffer.ergebnis.treffer, true, 'alle Beweise erfüllt: Treffer')
assert.deepEqual(treffer.aufrufe.kopiert, [['/tmp/artifact.tar', 'z.tar']])
assert.deepEqual(treffer.aufrufe.geladen, [[REPO, 5]], 'geladen wird das Artefakt des gewählten Laufs')
assert.ok(treffer.aufrufe.git.includes('rev-parse HEAD~1:.github'), 'Vergleich mit dem Elterncommit')

function keinTreffer(beschreibung, zusatz, grund) {
  const { ergebnis, aufrufe } = lauf(zusatz)
  assert.equal(ergebnis.treffer, false, `${beschreibung}: kein Treffer`)
  assert.match(ergebnis.grund, grund, beschreibung)
  assert.deepEqual(aufrufe.kopiert, [], `${beschreibung}: nichts kopiert`)
}

keinTreffer('Baum weicht ab (main weitergewandert)', { version: JSON.stringify({ baum: 'f'.repeat(40) }) }, /Baum des Baus .* weicht ab/)
keinTreffer('Artefakt ohne Baum', { version: '' }, /Baum des Baus/)
keinTreffer('.github/ im Commit geändert', { git: { 'rev-parse HEAD:.github': 'e'.repeat(40) } }, /\.github\/ weicht/)
keinTreffer('.github/ nur im Elterncommit anders', { git: { 'rev-parse HEAD~1:.github': 'e'.repeat(40) } }, /\.github\/ weicht/)
keinTreffer('kein Elterncommit', { git: { 'rev-parse HEAD~1:.github': undefined } }, /Elterncommit/)
keinTreffer('kein gemergter PR', { prs: [] }, /kein gemergter PR/)
keinTreffer('PR nicht gemergt', { prs: [{ number: 7, merged_at: null, merge_commit_sha: SHA, base: { ref: 'main' }, head: { sha: KOPF } }] }, /kein gemergter PR/)
keinTreffer('Sammeljob rot', { jobs: [{ name: 'PR-Prüfkette', conclusion: 'failure' }] }, /kein grüner Lauf/)
keinTreffer('Lauf aus einem Fork', { laeufe: [{ id: 5, event: 'pull_request', head_sha: KOPF, head_repository: { full_name: 'x/r' } }] }, /kein grüner Lauf/)
keinTreffer('Artefakt abgelaufen', { laden: () => { throw new Error('gone') } }, /nicht abrufbar/)
console.log('deploy-aus-build-holen.test: ok')
