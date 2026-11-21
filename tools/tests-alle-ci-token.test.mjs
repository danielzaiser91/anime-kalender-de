/**
 * `tools/tests-alle.mjs` startet jeden Test ohne die CI-Anmeldung (`GITHUB_ACTIONS`, `GH_TOKEN`, `GITHUB_TOKEN`, `GITHUB_REPOSITORY`, `GITHUB_RUN_ID`).
 * Anlass (21.11.2026): `nachlauf.yml` setzt `GH_TOKEN`; `quellen-pr.test.mjs` erbte es, `quellen-pr.sh` nahm den echten Token-Zweig und pushte ins echte Repo (Nachlauf durchgehend rot).
 * Läufer-Kopie in einem Wegwerf-Git-Repo mit einem Wegwerf-Test, der rot wird, sobald eine der Variablen ankommt oder `FREMDE_VARIABLE` fehlt.
 * Aufruf: `node tools/tests-alle-ci-token.test.mjs`
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { ohneCiToken } from './bau-umgebung.mjs'

const WURZEL = resolve(import.meta.dirname, '..')
const KOPIEN = ['tests-alle.mjs', 'tests-teil.mjs', 'arbeiterpool.mjs', 'git-stand-wache.mjs', 'sperre-umgebung.mjs', 'bau-umgebung.mjs', 'bestand-sperre.cjs', 'pr-basis.mjs', 'tests-liste.mjs', 'pruefung-ort.mjs']
// Fest eingetragen, nicht aus dem Modul gelesen (sonst wäre die Liste ihr eigenes Orakel).
const CI = ['GITHUB_ACTIONS', 'GH_TOKEN', 'GITHUB_TOKEN', 'GITHUB_REPOSITORY', 'GITHUB_RUN_ID']
const TEST = `const da = ${JSON.stringify(CI)}.filter((n) => n in process.env)
if (da.length) { console.error('CI-Variablen geerbt: ' + da.join(',')); process.exit(1) }
if (process.env.FREMDE_VARIABLE !== 'bleibt') { console.error('fremde Variable fehlt'); process.exit(1) }
`

// Einheit: genau diese fünf fallen weg, fremde bleiben, Eingabe bleibt unverändert.
const eingabe = { ...Object.fromEntries(CI.map((n) => [n, 'x'])), FREMDE_VARIABLE: 'bleibt', GITHUB_ENV: 'bleibt-auch' }
assert.deepEqual(ohneCiToken(eingabe), { FREMDE_VARIABLE: 'bleibt', GITHUB_ENV: 'bleibt-auch' })
assert.equal(eingabe.GH_TOKEN, 'x')
console.log('  ✓ ohneCiToken entfernt genau die fünf CI-Variablen')

const ordner = mkdtempSync(join(tmpdir(), 'tests-alle-ci-'))
try {
  mkdirSync(join(ordner, 'tools'))
  mkdirSync(join(ordner, '.claude', 'hooks'), { recursive: true })
  for (const k of KOPIEN) copyFileSync(join(WURZEL, 'tools', k), join(ordner, 'tools', k))
  copyFileSync(join(WURZEL, 'package.json'), join(ordner, 'package.json'))
  symlinkSync(join(WURZEL, 'node_modules'), join(ordner, 'node_modules'), 'junction')
  writeFileSync(join(ordner, 'tools', 'ci-umgebung.test.mjs'), TEST)
  writeFileSync(join(ordner, '.gitignore'), 'node_modules\n')
  const git = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: ordner, stdio: 'ignore', timeout: 30_000 })
  git('init', '-q')
  git('add', '.')
  git('commit', '-q', '-m', 'a')

  const env = { ...process.env, ...Object.fromEntries(CI.map((n) => [n, 'dummy'])), GITHUB_REPOSITORY: 'x/gibtsnicht', FREMDE_VARIABLE: 'bleibt' }
  const r = spawnSync(process.execPath, [join(ordner, 'tools', 'tests-alle.mjs')], { cwd: ordner, encoding: 'utf8', env, timeout: 120_000 })
  assert.equal(r.status, 0, `tests-alle: Exit ${r.status}\n${r.stdout}\n${r.stderr}`)
  assert.match(r.stdout, /1 von 1 Tests grün/)
  console.log('  ✓ tests-alle: Test sieht keine CI-Variable, fremde bleibt')
  console.log('tests-alle-ci-token.test: ok')
} finally {
  unlinkSync(join(ordner, 'node_modules')) // Link zuerst lösen, damit rmSync nicht ins echte node_modules greift
  rmSync(ordner, { recursive: true, force: true })
}
