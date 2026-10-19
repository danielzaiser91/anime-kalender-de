/**
 * Test zu `pr-basis.mjs`: echte Merge-Commits in Wegwerf-Repos (unter `os.tmpdir()` bzw. dem Wurzelordner im ersten Argument).
 * Belegt, dass die Basis der erste Elternteil ist, dass ein veraltetes `base.sha` im Ereignis nicht mehr greift (Pflicht-Wächter
 * als eigener Prozess) und dass ein linearer Kopf rot ist.
 * Aufruf: `node tools/pr-basis.test.mjs [Wurzelordner]`
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ersterElternteil, ladeBasis } from './pr-basis.mjs'

const WURZEL = process.argv[2] ?? tmpdir()
const PFLICHT = resolve(import.meta.dirname, 'check-patchnotes-pflicht.mjs')

const gitIn = (ordner) => (...args) =>
  execFileSync('git', ['-c', 'core.autocrlf=false', '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: ordner, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim()

function schreibe(ordner, pfad, inhalt) {
  mkdirSync(join(ordner, pfad, '..'), { recursive: true })
  writeFileSync(join(ordner, pfad), inhalt)
}

function commit(git, ordner, pfad, inhalt) {
  schreibe(ordner, pfad, inhalt)
  git('add', '-A')
  git('commit', '-q', '-m', pfad)
  return git('rev-parse', 'HEAD')
}

/** Basis B, danach ändert main `web/src/fremd.ts`; der PR-Zweig ändert `prDatei`; HEAD ist der Merge-Commit (oder, linear, nur der PR-Commit). */
function baue(ordner, { prDatei, linear = false }) {
  const git = gitIn(ordner)
  git('init', '-q', '-b', 'main')
  const basis = commit(git, ordner, 'README.md', 'a')
  git('checkout', '-q', '-b', 'pr')
  const prKopf = commit(git, ordner, prDatei, 'pr')
  git('checkout', '-q', 'main')
  const mainKopf = commit(git, ordner, 'web/src/fremd.ts', 'fremd')
  if (linear) git('checkout', '-q', 'pr')
  else git('merge', '-q', '--no-ff', '-m', 'Merge pr into main', 'pr')
  return { git, basis, mainKopf, prKopf }
}

function pflichtLauf(ordner, basisSha, arbeit = ordner) {
  const ereignis = join(ordner, '..', `${basisSha}.json`)
  writeFileSync(ereignis, JSON.stringify({ pull_request: { base: { sha: basisSha }, head: { ref: 'fix/x' }, body: '' } }))
  const env = { ...process.env, GITHUB_EVENT_NAME: 'pull_request', GITHUB_EVENT_PATH: ereignis }
  const r = spawnSync(process.execPath, [PFLICHT], { cwd: arbeit, env, encoding: 'utf8', windowsHide: true })
  rmSync(ereignis)
  return { status: r.status, ausgabe: `${r.stdout}${r.stderr}` }
}

function mitRepo(optionen, fn) {
  const ordner = mkdtempSync(join(WURZEL, 'pr-basis-'))
  try {
    fn(ordner, baue(ordner, optionen))
  } finally {
    rmSync(ordner, { recursive: true, force: true })
  }
}

mitRepo({ prDatei: 'docs/pr.md' }, (ordner, { git, mainKopf, prKopf }) => {
  assert.equal(ersterElternteil(git), mainKopf, 'erster Elternteil ist der main-Kopf, nicht der PR-Kopf')
  assert.notEqual(ersterElternteil(git), prKopf)
  assert.equal(ladeBasis(git), mainKopf)
})

mitRepo({ prDatei: 'docs/pr.md' }, (ordner, { basis }) => {
  const r = pflichtLauf(ordner, basis)
  assert.equal(r.status, 0, `veraltetes base.sha: fremde Änderung von main zählt nicht (${r.ausgabe})`)
})

mitRepo({ prDatei: 'web/src/eigen.ts' }, (ordner, { basis }) => {
  const r = pflichtLauf(ordner, basis)
  assert.equal(r.status, 1, `eigene sichtbare Änderung ohne Patch Note bleibt rot (${r.ausgabe})`)
})

mitRepo({ prDatei: 'docs/pr.md', linear: true }, (ordner, { git }) => {
  assert.throws(() => ersterElternteil(git), /kein Merge-Commit/)
})

mitRepo({ prDatei: 'docs/pr.md' }, (ordner, { git, mainKopf, basis }) => {
  git('config', 'uploadpack.allowAnySHA1InWant', 'true')
  const flach = mkdtempSync(join(WURZEL, 'pr-basis-klon-'))
  try {
    execFileSync('git', ['clone', '-q', '--depth=1', pathToFileURL(ordner).href, flach], { windowsHide: true })
    const flachLauf = pflichtLauf(ordner, basis, flach)
    assert.equal(flachLauf.status, 0, `Pflicht-Wächter im flachen Klon lädt die Basis nach (${flachLauf.ausgabe})`)
    const gitFlach = gitIn(flach)
    assert.equal(ersterElternteil(gitFlach), mainKopf, 'Elternteil lesbar, obwohl der Klon flach ist')
    assert.equal(ladeBasis(gitFlach), mainKopf)
    assert.equal(gitFlach('cat-file', '-t', mainKopf), 'commit', 'Basis nachgeladen')
  } finally {
    rmSync(flach, { recursive: true, force: true })
  }
})

console.log('  ✓ PR-Basis: erster Elternteil des Merge-Commits, veraltetes base.sha greift nicht, linearer Kopf ist rot')
