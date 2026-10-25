/**
 * Test zu tools/extension-version.mjs: Entscheidungstabelle, Prozesslauf im Wegwerf-Repo (Zähler) und
 * die Verdrahtung in tools/pr-vorpruefung.mjs (PR hebt die Version an -> rot).
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parse } from 'yaml'
import { anhebungRot, naechsteVersion, versionVon, zaehltAlsAuslieferung } from './extension-version.mjs'

const tools = import.meta.dirname
const man = (v) => `{\n  "name": "x",\n  "version": "${v}",\n  "manifest_version": 3\n}\n`

// Reine Entscheidung
assert.equal(versionVon(man('4.32.9')), '4.32.9')
assert.equal(versionVon('{}'), null)
assert.equal(zaehltAlsAuslieferung('extension/melder.js'), true)
assert.equal(zaehltAlsAuslieferung('extension/manifest.json'), true)
assert.equal(zaehltAlsAuslieferung('extension/melder.test.cjs'), false)
assert.equal(zaehltAlsAuslieferung('extension/x.fixture.json'), false)
assert.equal(zaehltAlsAuslieferung('extension/README.md'), false)
assert.equal(zaehltAlsAuslieferung('tools/melder.js'), false)
assert.equal(zaehltAlsAuslieferung('web/extension/a.js'), false)
const e = naechsteVersion({ dateien: ['extension/a.js'], vorherText: man('4.32.9'), bisText: man('4.32.9'), aktuellText: man('4.32.9') })
assert.equal(e.text, man('4.32.10'), 'letzte Stelle zählt, zweistellig')
assert.equal(naechsteVersion({ dateien: ['extension/a.js'], vorherText: null, bisText: man('1.2.3'), aktuellText: man('1.2.3') }).text, man('1.2.4'), 'Manifest neu')
assert.equal(naechsteVersion({ dateien: ['extension/a.test.cjs', 'docs/x.md'], vorherText: man('4.0.1'), bisText: man('4.0.1'), aktuellText: man('4.0.1') }).text, null, 'nur Tests')
assert.equal(naechsteVersion({ dateien: [], vorherText: man('4.0.1'), bisText: man('4.0.1'), aktuellText: man('4.0.1') }).text, null, 'leere Spanne')
assert.equal(naechsteVersion({ dateien: ['extension/a.js'], vorherText: man('4.0.1'), bisText: man('4.0.5'), aktuellText: man('4.0.5') }).text, null, 'von Hand angehoben')
const rennen = naechsteVersion({ dateien: ['extension/a.js'], vorherText: man('4.32.2'), bisText: man('4.32.2'), aktuellText: man('4.32.3') })
assert.equal(rennen.text, man('4.32.4'), 'früherer Zähler schon auf main: zählt auf der Arbeitskopie weiter, überspringt nicht')
assert.throws(() => naechsteVersion({ dateien: ['extension/a.js'], vorherText: man('1.0.0'), bisText: '{}', aktuellText: '{}' }), /ohne lesbare Version/)
assert.equal(anhebungRot(man('4.0.1'), man('4.0.1')), null)
assert.equal(anhebungRot(man('4.0.1'), man('4.0.2')) !== null, true)
assert.equal(anhebungRot(null, man('4.0.2')), null, 'Manifest neu im PR')

// Prozess im Wegwerf-Repo
const wurzel = mkdtempSync(join(tmpdir(), 'extension-version-'))
const git = (cwd, ...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const ruf = (cwd, skript, ...a) => spawnSync(process.execPath, [join(tools, skript), ...a], { cwd, encoding: 'utf8' })

function repo(name) {
  const arbeit = join(wurzel, name)
  mkdirSync(join(arbeit, 'extension'), { recursive: true })
  mkdirSync(join(arbeit, 'tools'))
  writeFileSync(join(arbeit, 'tools/umfang-pruefen.mjs'), "console.log('ok')\n")
  writeFileSync(join(arbeit, 'extension/manifest.json'), man('4.32.2'))
  writeFileSync(join(arbeit, 'extension/a.js'), '1\n')
  git(arbeit, 'init', '-q', '-b', 'main')
  git(arbeit, 'add', '.')
  git(arbeit, 'commit', '-q', '-m', 'basis')
  return arbeit
}

try {
  const a = repo('zaehler')
  const basis = git(a, 'rev-parse', 'HEAD').trim()
  writeFileSync(join(a, 'extension/a.js'), '2\n')
  git(a, 'commit', '-qam', 'code')
  const bis = git(a, 'rev-parse', 'HEAD').trim()
  const r = ruf(a, 'extension-version.mjs', '--von', basis, '--bis', bis)
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /angehoben \(4\.32\.2 -> 4\.32\.3\)/)
  assert.equal(readFileSync(join(a, 'extension/manifest.json'), 'utf8'), man('4.32.3'), 'nur die Versionszeile ändert sich')
  git(a, 'commit', '-qam', 'bump')
  const zweiter = ruf(a, 'extension-version.mjs', '--von', bis, '--bis', git(a, 'rev-parse', 'HEAD').trim())
  assert.match(zweiter.stdout, /unverändert \(Version schon angehoben/, 'der Bump-Commit selbst löst nichts aus')
  assert.equal(readFileSync(join(a, 'extension/manifest.json'), 'utf8'), man('4.32.3'))
  assert.notEqual(ruf(a, 'extension-version.mjs', '--von', bis).status, 0, '--bis fehlt: Fehler')

  // Vorprüfung: PR hebt an -> rot; ohne Anhebung grün
  for (const [name, hebt, erwartet] of [['pr-rot', true, 1], ['pr-gruen', false, 0]]) {
    const w = repo(name)
    git(w, 'update-ref', 'refs/remotes/origin/main', 'HEAD')
    git(w, 'remote', 'add', 'origin', w)
    git(w, 'checkout', '-q', '-b', 'fix/x')
    writeFileSync(join(w, 'extension/a.js'), '2\n')
    if (hebt) writeFileSync(join(w, 'extension/manifest.json'), man('4.32.3'))
    git(w, 'commit', '-qam', 'pr')
    const v = ruf(w, 'pr-vorpruefung.mjs', '--titel', 't', '--text', 'extension/a.js geändert. Patch Notes: keine – Technik')
    assert.equal(v.status, erwartet, `${name}: ${v.stdout}${v.stderr}`)
    if (hebt) assert.match(v.stderr, /Version 4\.32\.2 -> 4\.32\.3 im PR angehoben/)
  }
  // Workflow: Auslöser, Reihenfolge, Verdrahtung des Skripts und der Commit-Schritt gegen ein echtes „origin“
  const wf = parse(readFileSync(join(tools, '../.github/workflows/extension-version.yml'), 'utf8'))
  assert.deepEqual(wf.on.push, { branches: ['main'], paths: ['extension/**'] })
  assert.deepEqual(wf.concurrency, { group: 'extension-version', 'cancel-in-progress': false })
  const schritte = wf.jobs.zaehlen.steps
  const zaehlen = schritte.find((s) => s.name === 'Version zählen')
  assert.deepEqual(zaehlen.env, { VON: '${{ github.event.before }}', BIS: '${{ github.sha }}' })
  assert.match(zaehlen.run, /node tools\/extension-version\.mjs --von "\$VON" --bis "\$BIS"/)
  assert.ok(schritte.indexOf(zaehlen) < schritte.findIndex((s) => s.name === 'Zähler committen'), 'erst zählen, dann committen')
  const commitSchritt = schritte.find((s) => s.name === 'Zähler committen').run
  const bare = join(wurzel, 'origin.git')
  const basisRepo = repo('wf')
  git(wurzel, 'clone', '-q', '--bare', basisRepo, bare)
  const klon = (n) => {
    git(wurzel, 'clone', '-q', bare, join(wurzel, n))
    return join(wurzel, n)
  }
  const commitLauf = (cwd) => spawnSync('bash', ['-e', '-c', commitSchritt], { cwd, encoding: 'utf8' })
  const k1 = klon('k1')
  assert.equal(commitLauf(k1).status, 0, 'nichts geändert: Exit 0')
  assert.equal(git(k1, 'log', '--oneline').trim().split('\n').length, 1, 'nichts geändert: kein Commit')
  writeFileSync(join(k1, 'extension/manifest.json'), man('4.32.3'))
  assert.equal(commitLauf(k1).status, 0)
  assert.match(git(bare, 'log', '-1', '--format=%s', 'main'), /Version gezählt/, 'Zähler liegt auf origin')
  const k2 = klon('k2')
  const k3 = klon('k3')
  writeFileSync(join(k2, 'extension/a.js'), 'fremd\n')
  git(k2, 'commit', '-qam', 'fremd')
  git(k2, 'push', '-q')
  writeFileSync(join(k3, 'extension/manifest.json'), man('4.32.4'))
  const spaet = commitLauf(k3)
  assert.equal(spaet.status, 0, `origin ist weitergezogen, Neuversuch klappt: ${spaet.stderr}`)
  assert.equal(git(bare, 'show', 'main:extension/a.js'), 'fremd\n', 'fremder Commit bleibt')
  assert.equal(git(bare, 'show', 'main:extension/manifest.json'), man('4.32.4'))
  console.log('extension-version.test: ok (Tabelle, Zähler-Prozess, Vorprüfung rot/grün, Workflow-Schritte)')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
