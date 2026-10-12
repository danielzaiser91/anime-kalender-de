/**
 * Test für `tools/bau-vergleich-reste.mjs` in einem Wegwerf-Repo: ein gesperrter, auf der Platte fehlender `baum-*`-Worktree
 * in der Ablage wird entfernt (danach geht `worktree add` auf denselben Hash wieder); ein gesperrter Worktree, dessen Ordner
 * existiert, und ein gesperrter Fremdbaum außerhalb der Ablage bleiben unberührt.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { raeumeVerwaisteBaeume, verwaisteBaeume } from './bau-vergleich-reste.mjs'

const wurzel = mkdtempSync(path.join(tmpdir(), 'bau-vergleich-reste-'))
const ablage = path.join(wurzel, 'ablage')
const fremd = path.join(wurzel, 'fremd')
const git = (...args) =>
  execFileSync('git', ['-C', path.join(wurzel, 'repo'), '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { encoding: 'utf8' }).trim()
const eintraege = () => git('worktree', 'list', '--porcelain')

try {
  mkdirSync(path.join(wurzel, 'repo'), { recursive: true })
  mkdirSync(ablage, { recursive: true })
  git('init', '-q', '-b', 'main')
  writeFileSync(path.join(wurzel, 'repo', 'a.txt'), '1\n')
  git('add', '-A')
  git('commit', '-q', '-m', 'a')
  const sha = git('rev-parse', 'HEAD')

  const tot = path.join(ablage, 'baum-tot')
  const lebend = path.join(ablage, 'baum-lebend')
  const draussen = path.join(fremd, 'baum-draussen')
  for (const ort of [tot, lebend, draussen]) git('worktree', 'add', '--quiet', '--detach', ort, sha)
  for (const ort of [tot, lebend, draussen]) git('worktree', 'lock', '--reason', 'initializing', ort)
  rmSync(tot, { recursive: true, force: true }) // Prozess starb mitten im Anlegen
  rmSync(draussen, { recursive: true, force: true })

  assert.throws(() => git('worktree', 'add', '--quiet', '--detach', tot, sha), 'Ausgangslage: ohne Aufräumen scheitert die Neuanlage')
  git('worktree', 'prune')
  assert.ok(eintraege().includes('baum-tot'), 'Ausgangslage: prune lässt den gesperrten Eintrag stehen')

  assert.deepEqual(verwaisteBaeume(eintraege(), ablage).map((p) => path.basename(p)), ['baum-tot'], 'nur der gesperrte, fehlende Baum der Ablage')
  assert.deepEqual(verwaisteBaeume(eintraege(), path.join(wurzel, 'andere')), [], 'andere Ablage: nichts')

  const entfernt = raeumeVerwaisteBaeume(git, ablage)
  assert.deepEqual(entfernt.map((p) => path.basename(p)), ['baum-tot'])
  const danach = eintraege()
  assert.ok(!danach.includes('baum-tot'), 'verwaister Eintrag ist weg')
  assert.ok(danach.includes('baum-lebend'), 'gesperrter Baum mit Ordner bleibt')
  assert.ok(danach.includes('baum-draussen'), 'gesperrter Fremdbaum außerhalb der Ablage bleibt, auch ohne Ordner')
  git('worktree', 'add', '--quiet', '--detach', tot, sha)

  assert.deepEqual(raeumeVerwaisteBaeume(git, ablage), [], 'zweiter Lauf: nichts mehr zu tun')
  console.log('bau-vergleich-reste: ok')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
