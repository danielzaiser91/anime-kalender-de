/**
 * Ablauftest des Schritts „Jobfrist merken“ aus bestand-bauen.yml (`run` aus der YAML): ohne ihn hätte der Neuversuch in
 * `tools/commit-data.sh` keine Zeitgrenze (31.10.2026). Der Schritt muss BAU_FRIST_EPOCH nach GITHUB_ENV schreiben, vor „Änderungen committen“
 * stehen, und die Frist darf die Jobfrist nicht überschreiten.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const job = parse(readFileSync(join(wurzel, '.github/workflows/bestand-bauen.yml'), 'utf8')).jobs.bauen
const namen = job.steps.map((s) => s.name)
const treffer = job.steps.filter((s) => s.name === 'Jobfrist merken')
assert.equal(treffer.length, 1, 'genau ein Schritt „Jobfrist merken“')
assert.ok(namen.indexOf('Jobfrist merken') < namen.indexOf('Änderungen committen'), 'Frist steht vor dem Commit-Schritt')

const ordner = mkdtempSync(join(tmpdir(), 'jobfrist-'))
try {
  const envDatei = join(ordner, 'github-env.txt')
  writeFileSync(envDatei, '')
  const r = spawnSync('bash', ['-e', '-c', treffer[0].run], { encoding: 'utf8', timeout: 30000, env: { ...process.env, GITHUB_ENV: envDatei } })
  assert.equal(r.status, 0, r.stderr)
  const zeilen = readFileSync(envDatei, 'utf8').trim().split('\n')
  assert.equal(zeilen.length, 1, 'genau eine Zeile in GITHUB_ENV')
  assert.match(zeilen[0], /^BAU_FRIST_EPOCH=\d{10}$/)
  const jetzt = Number(spawnSync('date', ['+%s'], { encoding: 'utf8', timeout: 10000 }).stdout)
  const rest = Number(zeilen[0].split('=')[1]) - jetzt
  const jobSekunden = job['timeout-minutes'] * 60
  assert.ok(rest > 0 && rest <= jobSekunden, `Restzeit ${rest} s liegt innerhalb der Jobfrist ${jobSekunden} s`)
  assert.ok(rest >= jobSekunden - 5 * 60, `Restzeit ${rest} s: höchstens 5 min Abschlag auf die Jobfrist`)
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
console.log('bestand-jobfrist-schritt: Schritt vorhanden, schreibt BAU_FRIST_EPOCH nach GITHUB_ENV, Frist innerhalb der Jobfrist.')
