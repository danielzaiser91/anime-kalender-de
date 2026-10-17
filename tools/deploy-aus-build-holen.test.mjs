/**
 * Test zu `holeBau` in `tools/deploy-aus-build.mjs` mit Kulissen-Werkzeug (kein git, gh, tar): jede Beweisweiche hat einen Fall,
 * der ohne sie einen Treffer meldete. Aufruf: node tools/deploy-aus-build-holen.test.mjs
 */
import assert from 'node:assert/strict'
import { abdruck, PATCHNOTES_LOG } from './bau-eingaben.mjs'
import { holeBau, laufe } from './deploy-aus-build.mjs'

const REPO = 'o/r'
const SHA = 'a'.repeat(40)
const KOPF = 'c'.repeat(40)
const BAUM = 'b'.repeat(40)
const DIFF = 'diff --no-renames --name-only HEAD~1 HEAD -- .github'
const FREMD = ['.github/workflows/pr-pruefer.yml', '.github/workflows/refresh-data.yml']
/** Ausgabe von `git diff --name-only` mit der bedenklichen Datei zwischen zwei fremden Workflows. */
const diffMit = (p) => [FREMD[0], p, FREMD[1]].join('\n')
const LS = 'ls-tree -r -z HEAD'
/** `git ls-tree -r -z` eines Baums aus Pfad → Blob-Kennung (eine Ziffer, 40-fach). */
const lsTree = (dateien) => Object.entries(dateien).map(([p, k]) => `100644 blob ${k.repeat(40)}\t${p}\0`).join('')
const GEBAUT = { 'data/a.json': '1', 'data/kennungen.json': '1', 'status.md': '1', 'web/src/a.tsx': '1', 'data/z.json': '1' }
const LOG = PATCHNOTES_LOG.join(' ')
const FLACH = 'rev-parse --is-shallow-repository'
const VERTIEFEN = 'fetch --unshallow --filter=blob:none --quiet origin'
/** Ausgabe von `PATCHNOTES_LOG`: Commit-Zeit vor jeder hinzugefügten Patch Note. */
const PATCH_LOG = '@1760000000\n\ndata/patchnotes/a.yaml\n'
const ABDRUCK = abdruck(lsTree(GEBAUT), PATCH_LOG)
/** Bau der Kette mit anderem Baum (main ist weitergewandert), aber Abdruck des gebauten Stands. */
const MIT_ABDRUCK = JSON.stringify({ v: 'x', baum: 'f'.repeat(40), abdruck: ABDRUCK })
const mainMit = (aenderung, log = PATCH_LOG) => ({ version: MIT_ABDRUCK, git: { [LS]: lsTree({ ...GEBAUT, ...aenderung }), [LOG]: log } })

/** Kulisse eines Treffers; `zusatz` überschreibt einzelne Antworten. Unbekannte git-Aufrufe werfen wie ein fehlender Elterncommit. */
function kulisse(zusatz = {}) {
  const aufrufe = { kopiert: [], api: [], git: [], geladen: [] }
  const antworten = {
    'rev-parse HEAD^{tree}': BAUM,
    [DIFF]: '',
    [FLACH]: 'false\n',
    ...zusatz.git,
  }
  const pr = { number: 7, merged_at: 'x', merge_commit_sha: SHA, base: { ref: 'main' }, head: { sha: KOPF } }
  const anderer = { number: 8, merged_at: 'x', merge_commit_sha: 'e'.repeat(40), base: { ref: 'main' }, head: { sha: 'f'.repeat(40) } }
  const lauf = (id) => ({ id, event: 'pull_request', head_sha: KOPF, head_repository: { full_name: REPO } })
  const gruen = [{ name: 'PR-Prüfkette', conclusion: 'success' }]
  const rot = [{ name: 'PR-Prüfkette', conclusion: 'failure' }]
  const w = {
    git: (args) => {
      aufrufe.git.push(args.join(' '))
      const antwort = antworten[args.join(' ')]
      if (antwort === undefined) throw new Error('git: unbekannt')
      return antwort
    },
    api: (pfad) => {
      aufrufe.api.push(pfad)
      if (pfad === `repos/${REPO}/commits/${SHA}/pulls`) return zusatz.prs ?? [anderer, pr]
      if (pfad.startsWith(`repos/${REPO}/actions/workflows/`) && pfad.includes(`head_sha=${KOPF}&`)) return { workflow_runs: zusatz.laeufe ?? [lauf(9), lauf(5)] }
      const jobs = /\/actions\/runs\/(\d+)\/jobs$/.exec(pfad)
      if (jobs) return { jobs: zusatz.jobs ?? (jobs[1] === '5' ? gruen : rot) }
      throw new Error(`api: unbekannter Pfad ${pfad}`)
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
assert.match(treffer.ergebnis.grund, /^PR #7, Lauf 5$/, 'der PR mit dem Squash-Commit, nicht der erste der Liste')
assert.ok(treffer.aufrufe.git.includes(DIFF), 'Vergleich von .github/ mit dem Elterncommit')
const fremd = lauf({ git: { [DIFF]: `${FREMD.join('\n')}\n` } })
assert.equal(fremd.ergebnis.treffer, true, 'PR ändert nur Workflows außerhalb von Kette und Deploy: Treffer')
assert.deepEqual(fremd.aufrufe.kopiert, [['/tmp/artifact.tar', 'z.tar']])

function keinTreffer(beschreibung, zusatz, grund) {
  const { ergebnis, aufrufe } = lauf(zusatz)
  assert.equal(ergebnis.treffer, false, `${beschreibung}: kein Treffer`)
  assert.match(ergebnis.grund, grund, beschreibung)
  assert.deepEqual(aufrufe.kopiert, [], `${beschreibung}: nichts kopiert`)
}

keinTreffer('Baum weicht ab, kein Abdruck', { version: JSON.stringify({ baum: 'f'.repeat(40) }), git: { [LS]: lsTree(GEBAUT) } }, /Baum und Abdruck .* weichen ab/)
keinTreffer('Artefakt ohne Baum', { version: '' }, /Baum und Abdruck/)
// Abdruck (tools/bau-eingaben.mjs): main ist nur mit Dateien weitergewandert, die der Bau nicht liest.
const daten = lauf(mainMit({ 'data/a.json': '2', 'status.md': '3' }))
assert.equal(daten.ergebnis.treffer, true, 'nur freie Dateien geändert: Treffer')
assert.match(daten.ergebnis.grund, /^PR #7, Lauf 5, main seither nur mit Dateien weitergewandert/)
assert.deepEqual(daten.aufrufe.kopiert, [['/tmp/artifact.tar', 'z.tar']])
assert.ok(!treffer.aufrufe.git.includes(LS), 'gleicher Baum: kein Abdruck nötig')
keinTreffer('Code nach dem Bau geändert', mainMit({ 'web/src/a.tsx': '2' }), /Baum und Abdruck .* weichen ab/)
keinTreffer('Bau-Eingabe nach dem Bau geändert', mainMit({ 'data/kennungen.json': '2' }), /Baum und Abdruck/)
keinTreffer('freie Datei hinzugekommen', mainMit({ 'data/neu.json': '1' }), /Baum und Abdruck/)
keinTreffer('Abdruck verkürzt', { ...mainMit({}), version: JSON.stringify({ baum: 'f'.repeat(40), abdruck: ABDRUCK.slice(1) }) }, /Baum und Abdruck/)
const ersterAnders = `${ABDRUCK[0] === 'a' ? 'b' : 'a'}${ABDRUCK.slice(1)}`
keinTreffer('Abdruck im ersten Zeichen anders', { ...mainMit({}), version: JSON.stringify({ baum: 'f'.repeat(40), abdruck: ersterAnders }) }, /Baum und Abdruck/)
keinTreffer('Abdruck fehlt', { ...mainMit({}), version: JSON.stringify({ baum: 'f'.repeat(40) }) }, /Baum und Abdruck/)
keinTreffer('Abdruck ist keine Zeichenkette', { ...mainMit({}), version: JSON.stringify({ baum: 'f'.repeat(40), abdruck: 40 }) }, /Baum und Abdruck/)
keinTreffer('git ls-tree scheitert', { version: MIT_ABDRUCK, git: { [LOG]: PATCH_LOG } }, /Baum und Abdruck/)
// Datum der Patch Notes (Commit-Zeit, PATCHNOTES_LOG) zählt mit; der flache Deploy-Klon wird dafür vertieft.
keinTreffer('Patch Note mit anderer Commit-Zeit', mainMit({}, PATCH_LOG.replace('@1760000000', '@1760090000')), /Baum und Abdruck/)
keinTreffer('git log scheitert', { version: MIT_ABDRUCK, git: { [LS]: lsTree(GEBAUT) } }, /Baum und Abdruck/)
const flach = lauf({ ...mainMit({}), git: { ...mainMit({}).git, [FLACH]: 'true\n', [VERTIEFEN]: '' } })
assert.equal(flach.ergebnis.treffer, true, 'flacher Klon: vertieft, dann Treffer')
assert.deepEqual(flach.aufrufe.git.filter((a) => [FLACH, VERTIEFEN, LOG].includes(a)), [FLACH, VERTIEFEN, LOG], 'erst vertiefen, dann git log')
assert.ok(!lauf(mainMit({})).aufrufe.git.includes(VERTIEFEN), 'voller Klon: nicht vertiefen')
keinTreffer('Vertiefen scheitert', { ...mainMit({}), git: { ...mainMit({}).git, [FLACH]: 'true\n' } }, /Baum und Abdruck/)
assert.equal(lauf(mainMit({})).ergebnis.treffer, true, 'Abdruck gleich, Baum anders: Treffer')
keinTreffer('Kette im PR geändert', { git: { [DIFF]: diffMit('.github/workflows/pr-pruefung.yml') } }, /\.github\/ im PR geändert.*pr-pruefung\.yml/)
keinTreffer('Deploy im PR geändert', { git: { [DIFF]: diffMit('.github/workflows/deploy.yml') } }, /\.github\/ im PR geändert/)
keinTreffer('Action der Kette im PR geändert', { git: { [DIFF]: diffMit('.github/actions/kette-einrichten/action.yml') } }, /\.github\/ im PR geändert/)
keinTreffer('kein Elterncommit', { git: { [DIFF]: undefined } }, /Elterncommit/)
keinTreffer('kein gemergter PR', { prs: [] }, /kein gemergter PR/)
keinTreffer('PR nicht gemergt', { prs: [{ number: 7, merged_at: null, merge_commit_sha: SHA, base: { ref: 'main' }, head: { sha: KOPF } }] }, /kein gemergter PR/)
keinTreffer('Sammeljob rot', { jobs: [{ name: 'PR-Prüfkette', conclusion: 'failure' }] }, /kein grüner Lauf/)
keinTreffer('Lauf aus einem Fork', { laeufe: [{ id: 5, event: 'pull_request', head_sha: KOPF, head_repository: { full_name: 'x/r' } }] }, /kein grüner Lauf/)
keinTreffer('Artefakt abgelaufen', { laden: () => { throw new Error('gone') } }, /nicht abrufbar/)

// Ausgabeweg des Workflows: `treffer=1` nach $GITHUB_OUTPUT nur bei Treffer und nur mit gesetztem Pfad.
function ausgabe(zusatz, env) {
  const { w } = kulisse(zusatz)
  const geschrieben = []
  const treffer = laufe({ env: { GITHUB_REPOSITORY: REPO, GITHUB_SHA: SHA, ...env }, ziel: 'z.tar' }, w, (pfad, text) => geschrieben.push([pfad, text]), () => {})
  return { treffer, geschrieben }
}
assert.deepEqual(ausgabe({}, { GITHUB_OUTPUT: '/o' }), { treffer: true, geschrieben: [['/o', 'treffer=1\n']] })
assert.deepEqual(ausgabe({ prs: [] }, { GITHUB_OUTPUT: '/o' }), { treffer: false, geschrieben: [] }, 'ohne Treffer kein treffer=1')
assert.deepEqual(ausgabe({}, {}), { treffer: true, geschrieben: [] }, 'ohne GITHUB_OUTPUT nichts schreiben')
console.log('deploy-aus-build-holen.test: ok')
