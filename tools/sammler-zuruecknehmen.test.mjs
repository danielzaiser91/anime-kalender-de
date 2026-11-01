/**
 * Test für tools/sammler-zuruecknehmen.mjs: Nachstellung des 31.10.2026 (Sammler-Commit 1f15f63b ließ den Bestandsbau rot werden).
 * Echtes git in einem Wegwerf-Repo unter os.tmpdir(); der Bau ist eine Attrappe, die genau dann scheitert, wenn
 * die Vorschlagsdatei des Sammlers auf wenige Einträge geschrumpft ist.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import { zuruecknehmen, sammlerDateien, SAMMLER } from './sammler-zuruecknehmen.mjs'

const hier = path.dirname(fileURLToPath(import.meta.url))
const wurzel = fs.mkdtempSync(path.join(os.tmpdir(), 'szn-'))
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', windowsHide: true, timeout: 30000 }).trim()
const schreibe = (cwd, datei, text) => {
  fs.mkdirSync(path.dirname(path.join(cwd, datei)), { recursive: true })
  fs.writeFileSync(path.join(cwd, datei), text)
}
const lies = (cwd, datei) => (fs.existsSync(path.join(cwd, datei)) ? fs.readFileSync(path.join(cwd, datei), 'utf8') : 'fehlt')
function commit(cwd, autor, text, dateien) {
  for (const [d, t] of Object.entries(dateien)) {
    if (t === null) git(cwd, 'rm', '-q', d)
    else {
      schreibe(cwd, d, t)
      git(cwd, 'add', d)
    }
  }
  git(cwd, '-c', `user.name=${autor}`, '-c', 'user.email=x@example.org', 'commit', '-q', '-m', text)
  return git(cwd, 'rev-parse', 'HEAD')
}
let zaehler = 0
// Stand: grüner Bau bei BASIS; danach Sammler-Commit (schrumpft anime2you, legt neue Datei an) und ein Mensch-Commit.
function szenario(mitMensch = 'unabhaengig') {
  const cwd = path.join(wurzel, `fall-${++zaehler}`)
  fs.mkdirSync(cwd)
  git(cwd, 'init', '-q', '-b', 'main')
  const basis = commit(cwd, 'Daniel', 'basis', {
    'data/proposals/anime2you.json': '["a","b","c","d","e"]',
    'data/zweite-datei.json': '{"stand":"alt"}',
    'data/handbeleg.yaml': '- alt',
    'extension/x.js': 'alt',
  })
  const sammler = commit(cwd, SAMMLER, 'chore(data): Sendezeiten gesammelt', {
    'data/proposals/anime2you.json': '["a"]',
    'data/zweite-datei.json': '{"stand":"neu"}',
    'data/neu-vom-sammler.json': '{}',
    'extension/x.js': 'vom-sammler',
  })
  commit(cwd, 'Daniel', 'fix: etwas anderes', { 'pipeline/code.ts': 'neu', ...(mitMensch === 'selbe-datei' ? { 'data/zweite-datei.json': '{"stand":"mensch"}' } : {}) })
  return { cwd, basis, sammler }
}
const bauAttrappe = (cwd) => () => (JSON.parse(lies(cwd, 'data/proposals/anime2you.json')).length >= 3)
const aufrufe = []
const committen = (ok = true) => (text) => {
  aufrufe.push(text)
  return ok
}

// 1. Der echte Anlass: vorher rot (Bau scheitert), nachher grün und ausgeliefert.
{
  const { cwd, basis, sammler } = szenario()
  assert.equal(bauAttrappe(cwd)(), false, 'Ausgangslage muss rot sein')
  aufrufe.length = 0
  // Reste früherer Schritte des roten Laufs: geänderte und neue Dateien dürfen nicht im Commit landen.
  schreibe(cwd, 'data/handbeleg.yaml', '- vom-lauf')
  schreibe(cwd, 'data/reste-vom-lauf.json', '{}')
  let beimCommit = ''
  const e = zuruecknehmen({
    cwd,
    basis,
    bauen: bauAttrappe(cwd),
    committen: (text) => {
      beimCommit = git(cwd, 'status', '--porcelain', '-uall')
      return committen()(text)
    },
  })
  assert.equal(beimCommit.split('\n').map((z) => z.slice(3)).sort().join(','), 'data/neu-vom-sammler.json,data/proposals/anime2you.json,data/zweite-datei.json')
  assert.equal(lies(cwd, 'data/handbeleg.yaml'), '- alt')
  assert.equal(e.art, 'zurueckgenommen')
  assert.deepEqual(e.dateien, ['data/neu-vom-sammler.json', 'data/proposals/anime2you.json', 'data/zweite-datei.json'])
  assert.equal(lies(cwd, 'data/proposals/anime2you.json'), '["a","b","c","d","e"]')
  assert.equal(lies(cwd, 'data/zweite-datei.json'), '{"stand":"alt"}')
  assert.equal(lies(cwd, 'data/neu-vom-sammler.json'), 'fehlt', 'neue Sammler-Datei entfällt')
  assert.equal(lies(cwd, 'extension/x.js'), 'vom-sammler', 'nur data/ wird zurückgenommen')
  assert.equal(lies(cwd, 'pipeline/code.ts'), 'neu', 'Menschen-Commit bleibt')
  assert.equal(aufrufe.length, 1)
  assert.ok(aufrufe[0].startsWith('chore(data): Sammler-Stand zurückgenommen (') && aufrufe[0].includes(sammler.slice(0, 8)), aufrufe[0])
}

// 2. Eine Datei, die auch ein Mensch geändert hat, bleibt unberührt (Mensch-Arbeit geht nie verloren).
{
  const { cwd, basis } = szenario('selbe-datei')
  const e = zuruecknehmen({ cwd, basis, bauen: bauAttrappe(cwd), committen: committen() })
  assert.equal(e.art, 'zurueckgenommen')
  assert.ok(!e.dateien.includes('data/zweite-datei.json'))
  assert.equal(lies(cwd, 'data/zweite-datei.json'), '{"stand":"mensch"}')
}

// 3. Bleibt der Bau auch ohne den Sammler-Stand rot (Ursache woanders): alles zurück auf HEAD, nichts committet.
{
  const { cwd, basis } = szenario()
  aufrufe.length = 0
  const e = zuruecknehmen({ cwd, basis, bauen: () => false, committen: committen() })
  assert.equal(e.art, 'bleibt-rot')
  assert.equal(aufrufe.length, 0, 'bei rotem Bau kein Commit')
  assert.equal(git(cwd, 'status', '--porcelain'), '', 'Arbeitsbaum wieder auf HEAD')
  assert.equal(lies(cwd, 'data/neu-vom-sammler.json'), '{}')
}

// 4. Bau grün, aber commit-data scheitert (check:bestand rot): ebenfalls alles zurück.
{
  const { cwd, basis } = szenario()
  const e = zuruecknehmen({ cwd, basis, bauen: () => true, committen: committen(false) })
  assert.equal(e.art, 'bleibt-rot')
  assert.equal(git(cwd, 'status', '--porcelain'), '')
}

// 5. Kein Sammler-Commit in der Spanne: nichts tun, nicht einmal bauen.
{
  const cwd = path.join(wurzel, 'ohne')
  fs.mkdirSync(cwd)
  git(cwd, 'init', '-q', '-b', 'main')
  const basis = commit(cwd, 'Daniel', 'basis', { 'data/a.json': '1' })
  commit(cwd, 'Daniel', 'mensch', { 'data/a.json': '2' })
  let gebaut = 0
  const e = zuruecknehmen({ cwd, basis, bauen: () => { gebaut++; return true }, committen: committen() })
  assert.equal(e.art, 'nichts')
  assert.equal(gebaut, 0)
}

// 6. Reine Auswahlregel: Cache, Nicht-data-Pfade, gemischte Dateien; ein Sammler-Commit, der eine Datei löscht.
assert.deepEqual(
  sammlerDateien([
    { autor: SAMMLER, dateien: [['data', 'cache/x.json'].join('/'), 'data/a.json', 'data/b.json', 'public/data/t.json', 'data/dub-confirmed.yaml'] },
    { autor: 'github-actions[bot]', dateien: ['data/b.json'] },
  ]),
  ['data/a.json', 'data/dub-confirmed.yaml'],
)

// 7. Prozess: Standardaufruf, Zweite Ausführung ist ein Leerlauf, fehlende Basis ist ein Aufruffehler mit Text.
{
  const { cwd, basis } = szenario()
  const fake = path.join(wurzel, 'fake.mjs')
  fs.writeFileSync(fake, [
    "import fs from 'node:fs'",
    "const n = JSON.parse(fs.readFileSync('data/proposals/anime2you.json', 'utf8')).length",
    "if (process.argv[2] === 'bau') process.exit(n >= 3 ? 0 : 1)",
    "fs.appendFileSync('commit-aufrufe.txt', process.env.SZN_NACHRICHT + '|' + process.env.BAU_LAUF + '\\n')",
  ].join('\n'))
  const env = { ...process.env, SZN_BAU: `node "${fake}" bau`, SZN_COMMIT: `node "${fake}" commit` }
  const lauf = (...args) => spawnSync(process.execPath, [path.join(hier, 'sammler-zuruecknehmen.mjs'), ...args], { cwd, env, encoding: 'utf8', windowsHide: true, timeout: 60000 })
  const r = lauf('--basis', basis)
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /Sammler-Zurücknahme: zurueckgenommen \(3 Dateien/)
  assert.match(lies(cwd, 'commit-aufrufe.txt'), /^chore\(data\): Sammler-Stand zurückgenommen \([0-9a-f]{8}\)\|1\n$/)
  const leer = lauf('--basis', 'HEAD')
  assert.match(leer.stdout, /Sammler-Zurücknahme: nichts \(0 Dateien/)
  const ohne = lauf()
  assert.equal(ohne.status, 2)
  assert.match(ohne.stderr, /--basis/)
}

// 8. Verdrahtung im Workflow: Schritt nach dem Artefakt, vor dem Abmelden, nur bei Fehler, ruft das Werkzeug mit der Basis; Recht zum Lesen der Läufe.
{
  const wf = yaml.load(fs.readFileSync(path.join(hier, '..', '.github', 'workflows', 'bestand-bauen.yml'), 'utf8'))
  assert.equal(wf.permissions.actions, 'read')
  const schritte = wf.jobs.bauen.steps
  const idx = schritte.findIndex((s) => s.name?.startsWith('Sammler-Stand seit dem letzten grünen Bau'))
  assert.ok(idx > 0, 'Schritt fehlt')
  const s = schritte[idx]
  assert.equal(s.if, 'failure()')
  assert.equal(s['continue-on-error'], true)
  assert.match(s.run, /node tools\/sammler-zuruecknehmen\.mjs --basis "\$basis"/)
  assert.match(s.run, /basis="\$\(bash tools\/sammler-basis\.sh\)"/)
  assert.match(s.run, /git fetch --no-tags --depth=\d+ origin main/)
  assert.ok(idx > schritte.findIndex((x) => x.name?.startsWith('Eingaben des roten Baus')))
  assert.equal(schritte[idx + 1].name, 'Lauf abmelden')
}

// 9. Der ganze Schritt (Text aus der YAML) mit gh-Attrappe, die echte API-Formen durch jq schickt: Der neueste „success“-Lauf hat bauen=skipped
//    (gemessen 01.11.2026, Lauf 41317501990) und darf nicht die Basis sein; die Basis ist der letzte Lauf mit gebautem Job.
const jqDa = spawnSync('jq', ['--version'], { encoding: 'utf8', windowsHide: true, timeout: 10000 }).status === 0
if (!jqDa) console.log('Schritt-Ablauf mit gh-Attrappe übersprungen: jq fehlt')
else {
  const { cwd, basis } = szenario()
  const fix = path.join(wurzel, 'fix')
  fs.mkdirSync(fix)
  const kopf = git(cwd, 'rev-parse', 'HEAD')
  const lauf = (id, sha, bauen) => ({ run: { id, head_sha: sha, conclusion: 'success', event: 'push' }, jobs: { total_count: 2, jobs: [{ name: 'vorab', conclusion: 'success' }, { name: 'bauen', conclusion: bauen }] } })
  const laeufe = [lauf(41317501990, kopf, 'skipped'), lauf(41314588558, basis, 'success')]
  fs.writeFileSync(path.join(fix, 'runs.json'), JSON.stringify({ total_count: 2, workflow_runs: laeufe.map((l) => l.run) }))
  for (const l of laeufe) fs.writeFileSync(path.join(fix, `jobs-${l.run.id}.json`), JSON.stringify(l.jobs))
  const ghDir = path.join(wurzel, 'bin')
  fs.mkdirSync(ghDir)
  fs.writeFileSync(path.join(ghDir, 'gh'), [
    '#!/usr/bin/env bash',
    'url="$2"',
    'case "$url" in',
    '  */runs\\?*) datei="$FIX/runs.json" ;;',
    '  */runs/*/jobs) id="${url%/jobs}"; datei="$FIX/jobs-${id##*/}.json" ;;',
    '  *) echo "unerwartete Adresse: $url" >&2; exit 1 ;;',
    'esac',
    'jq -r "$4" "$datei"',
  ].join('\n'))
  fs.chmodSync(path.join(ghDir, 'gh'), 0o755)
  // Origin als lokales Bare-Repo, die beiden Werkzeugdateien als Mensch-Commit im Arbeitsrepo (reset/clean im Schritt löscht Unversioniertes).
  const origin = path.join(wurzel, 'origin.git')
  git(wurzel, 'init', '-q', '--bare', '-b', 'main', origin)
  fs.mkdirSync(path.join(cwd, 'tools'))
  for (const f of ['sammler-basis.sh', 'sammler-zuruecknehmen.mjs']) fs.copyFileSync(path.join(hier, f), path.join(cwd, 'tools', f))
  git(cwd, 'add', 'tools')
  git(cwd, '-c', 'user.name=Daniel', '-c', 'user.email=x@example.org', 'commit', '-q', '-m', 'werkzeug')
  git(cwd, 'remote', 'add', 'origin', origin)
  git(cwd, 'push', '-q', 'origin', 'main')
  const fake = path.join(wurzel, 'fake2.mjs')
  fs.writeFileSync(fake, [
    "import fs from 'node:fs'",
    "const n = JSON.parse(fs.readFileSync('data/proposals/anime2you.json', 'utf8')).length",
    "if (process.argv[2] === 'bau') process.exit(n >= 3 ? 0 : 1)",
    "fs.appendFileSync('commit-aufrufe.txt', process.env.SZN_NACHRICHT + '\\n')",
  ].join('\n'))
  const wf = yaml.load(fs.readFileSync(path.join(hier, '..', '.github', 'workflows', 'bestand-bauen.yml'), 'utf8'))
  const text = wf.jobs.bauen.steps.find((x) => x.name?.startsWith('Sammler-Stand seit dem letzten grünen Bau')).run
  const env = {
    ...process.env,
    PATH: ghDir + path.delimiter + process.env.PATH,
    FIX: fix.replaceAll('\\', '/'),
    GITHUB_REPOSITORY: 'x/y',
    SZN_BAU: `node "${fake}" bau`,
    SZN_COMMIT: `node "${fake}" commit`,
  }
  const r = spawnSync('bash', ['-c', text], { cwd, env, encoding: 'utf8', windowsHide: true, timeout: 120000 })
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /Sammler-Zurücknahme: zurueckgenommen \(3 Dateien/)
  assert.match(lies(cwd, 'commit-aufrufe.txt'), /^chore\(data\): Sammler-Stand zurückgenommen \(/)
  assert.equal(lies(cwd, 'data/proposals/anime2you.json'), '["a","b","c","d","e"]')
  // Kein gebauter Lauf in der Liste: Warnung, keine Wirkung.
  fs.writeFileSync(path.join(fix, 'jobs-41314588558.json'), JSON.stringify({ jobs: [{ name: 'bauen', conclusion: 'failure' }] }))
  git(cwd, 'checkout', '-q', 'HEAD', '--', '.')
  const leer = spawnSync('bash', ['-c', text], { cwd, env, encoding: 'utf8', windowsHide: true, timeout: 120000 })
  assert.equal(leer.status, 0)
  assert.match(leer.stdout, /::warning::Letzter grüner Bau/)
}

fs.rmSync(wurzel, { recursive: true, force: true })
console.log('sammler-zuruecknehmen.test: ok (Anlass 31.10.2026 grün nach Zurücknahme, 3 Rückfälle, Auswahlregel, Prozess, Workflow-Verdrahtung, Schritt-Ablauf mit gh-Attrappe)')
