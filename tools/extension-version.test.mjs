/**
 * Test zu tools/extension-version.mjs: Entscheidungstabelle, Prozesslauf im Wegwerf-Repo (Zähler) und
 * die Verdrahtung in tools/pr-vorpruefung.mjs (PR hebt die Version an -> rot).
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parse } from 'yaml'
import { ZAEHLER_BETREFF, anhebungRot, naechsteVersion, versionVon, zaehltAlsAuslieferung } from './extension-version.mjs'

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
assert.throws(() => naechsteVersion({ dateien: ['extension/a.js'], vorherText: man('1.0.0'), bisText: man('1.0.0'), aktuellText: '{}' }), /ohne lesbare Version/, 'Arbeitskopie ohne Version')
assert.equal(anhebungRot(man('4.0.1'), '{}'), null, 'PR löscht die Version: kein Anhebungs-Befund')
const rest = naechsteVersion({ dateien: ['extension/a.js'], vorherText: man('4.32.2'), bisText: man('4.32.2'), aktuellText: man('4.32.3').replace('"x"', '"anderer-name"') })
assert.equal(rest.text, man('4.32.4').replace('"x"', '"anderer-name"'), 'der Rest der Arbeitskopie bleibt erhalten')
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
  copyFileSync(join(tools, 'extension-version.mjs'), join(arbeit, 'tools/extension-version.mjs'))
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
  const ohneBis = ruf(a, 'extension-version.mjs', '--von', bis)
  assert.match(ohneBis.stdout, /unverändert \(Version schon angehoben/, '--bis fehlt: gilt HEAD')
  mkdirSync(join(a, 'andere'))
  writeFileSync(join(a, 'andere/m.json'), man('7.0.0'))
  git(a, 'add', '.')
  git(a, 'commit', '-qm', 'fremdes Manifest')
  git(a, 'tag', 'x')
  writeFileSync(join(a, 'extension/a.js'), '3\n')
  git(a, 'commit', '-qam', 'code2')
  const eigen = ruf(a, 'extension-version.mjs', '--von', 'x', '--bis', 'HEAD', '--manifest', 'andere/m.json')
  assert.equal(readFileSync(join(a, 'andere/m.json'), 'utf8'), man('7.0.1'), `--manifest wirkt: ${eigen.stdout}${eigen.stderr}`)
  assert.equal(readFileSync(join(a, 'extension/manifest.json'), 'utf8'), man('4.32.3'), 'Standard-Manifest bleibt unberührt')

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
  // main hat nach der Abzweigung gezählt, der PR rührt das Manifest nicht an: grün (Vergleich an der Merge-Basis)
  const m = repo('pr-main-weiter')
  git(m, 'checkout', '-q', '-b', 'fix/x')
  writeFileSync(join(m, 'extension/a.js'), '2\n')
  git(m, 'commit', '-qam', 'pr')
  git(m, 'checkout', '-q', 'main')
  writeFileSync(join(m, 'extension/manifest.json'), man('4.32.3'))
  git(m, 'commit', '-qam', ZAEHLER_BETREFF)
  git(m, 'update-ref', 'refs/remotes/origin/main', 'main')
  git(m, 'remote', 'add', 'origin', m)
  git(m, 'checkout', '-q', 'fix/x')
  const weiter = ruf(m, 'pr-vorpruefung.mjs', '--titel', 't', '--text', 'extension/a.js geändert. Patch Notes: keine – Technik')
  assert.equal(weiter.status, 0, `main weitergezählt, PR unberührt: ${weiter.stdout}${weiter.stderr}`)

  // Spanne seit dem jüngsten Zähler-Commit, nicht seit dem Push
  const s = repo('spanne')
  const zaehle = (...a) => ruf(s, 'extension-version.mjs', ...a)
  const basisSha = git(s, 'rev-parse', 'HEAD').trim()
  assert.match(zaehle().stderr, /kein Zähler-Commit gefunden/, 'weder Zähler noch Rückfall: Fehler')
  writeFileSync(join(s, 'extension/a.js'), 'A\n')
  git(s, 'commit', '-qam', 'code A')
  const ohneZaehler = zaehle('--rueckfall', basisSha)
  assert.match(ohneZaehler.stdout, /angehoben \(4\.32\.2 -> 4\.32\.3\)/, `Rückfall gilt ohne Zähler-Commit: ${ohneZaehler.stderr}`)
  git(s, 'commit', '-qam', ZAEHLER_BETREFF)
  const zaehlerSha = git(s, 'rev-parse', 'HEAD').trim()
  writeFileSync(join(s, 'extension/a.js'), 'B\n')
  git(s, 'commit', '-qam', 'code B')
  writeFileSync(join(s, 'extension/a.js'), 'C\n')
  git(s, 'commit', '-qam', 'code C')
  const kopf = git(s, 'rev-parse', 'HEAD').trim()
  assert.match(zaehle('--rueckfall', kopf).stdout, /angehoben \(4\.32\.3 -> 4\.32\.4\)/, 'B und C zusammen: eine Anhebung, Rückfall ignoriert')
  git(s, 'commit', '-qam', ZAEHLER_BETREFF)
  assert.match(zaehle('--rueckfall', basisSha).stdout, /unverändert \(kein ausgelieferter/, 'nichts seit dem Zähler: kein zweites Mal')
  // Betreff allein macht keinen Zähler: nur Code (a), Code und Manifest (b), Betreff nur als Teilstück (c)
  const hand = /Version schon angehoben \(4\.32\.4 -> 4\.32\.9\)/
  writeFileSync(join(s, 'extension/a.js'), 'D\n')
  git(s, 'commit', '-qam', ZAEHLER_BETREFF)
  assert.match(zaehle('--rueckfall', basisSha).stdout, /angehoben \(4\.32\.4 -> 4\.32\.5\)/, '(a) gleicher Betreff mit Code ist kein Zähler')
  git(s, 'reset', '-q', '--hard', 'HEAD~1')
  writeFileSync(join(s, 'extension/manifest.json'), man('4.32.9'))
  writeFileSync(join(s, 'extension/z.js'), 'E\n')
  git(s, 'add', 'extension/z.js')
  git(s, 'commit', '-qam', ZAEHLER_BETREFF)
  assert.match(zaehle('--rueckfall', basisSha).stdout, hand, '(b) Betreff, Manifest und Code zugleich ist kein Zähler')
  git(s, 'reset', '-q', '--hard', 'HEAD~1')
  writeFileSync(join(s, 'extension/manifest.json'), man('4.32.9'))
  git(s, 'commit', '-qam', `x ${ZAEHLER_BETREFF} y`)
  assert.match(zaehle('--rueckfall', basisSha).stdout, hand, '(c) Betreff nur als Teilstück zählt nicht')
  assert.match(zaehle('--von', zaehlerSha).stdout, /Version schon angehoben \(4\.32\.3 -> 4\.32\.9\)/, '--von überschreibt die Suche')

  // Workflow: Auslöser, Reihenfolge, Verdrahtung des Skripts und der Commit-Schritt gegen ein echtes „origin“
  const wf = parse(readFileSync(join(tools, '../.github/workflows/extension-version.yml'), 'utf8'))
  assert.deepEqual(wf.on.push, { branches: ['main'], paths: ['extension/**'] })
  assert.deepEqual(wf.concurrency, { group: 'extension-version', 'cancel-in-progress': false })
  const schritte = wf.jobs.zaehlen.steps
  const zaehlen = schritte.find((s) => s.name === 'Version zählen')
  assert.deepEqual(zaehlen.env, { VOR_PUSH: '${{ github.event.before }}' })
  assert.match(zaehlen.run, /node tools\/extension-version\.mjs --rueckfall "\$VOR_PUSH"/)
  assert.ok(schritte.find((s) => s.name === 'Zähler committen').run.includes(`git commit -m "${ZAEHLER_BETREFF}"`), 'Betreff wie die Suche ihn liest')
  assert.ok(schritte.indexOf(zaehlen) < schritte.findIndex((s) => s.name === 'Zähler committen'), 'erst zählen, dann committen')
  const commitSchritt = schritte.find((s) => s.name === 'Zähler committen').run
  const bare = join(wurzel, 'origin.git')
  const basisRepo = repo('wf')
  git(wurzel, 'clone', '-q', '--bare', basisRepo, bare)
  git(bare, 'config', 'uploadpack.allowFilter', 'true')
  git(bare, 'config', 'uploadpack.allowAnySHA1InWant', 'true')
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
  // Zwei Merges ohne Zähler dazwischen, flacher Klon wie actions/checkout: ein Lauf zählt beide genau einmal
  const vorPush = git(bare, 'rev-parse', 'main').trim()
  for (const [n, inhalt] of [['kA', 'A\n'], ['kB', 'B\n']]) {
    const k = klon(n)
    writeFileSync(join(k, 'extension/a.js'), inhalt)
    git(k, 'commit', '-qam', `code ${n}`)
    git(k, 'push', '-q')
  }
  const flachLauf = (name, rueckfall) => {
    const ziel = join(wurzel, name)
    git(wurzel, 'clone', '-q', '--depth=1', `file://${bare.split('\\').join('/')}`, ziel)
    const r = spawnSync('bash', ['-e', '-c', zaehlen.run], { cwd: ziel, encoding: 'utf8', env: { ...process.env, VOR_PUSH: rueckfall } })
    assert.equal(r.status, 0, `${name}: ${r.stderr}`)
    return { ziel, stdout: r.stdout }
  }
  const erster = flachLauf('flach1', vorPush)
  assert.match(erster.stdout, /angehoben \(4\.32\.3 -> 4\.32\.4\)/, 'beide Merges seit dem Zähler: eine Anhebung')
  assert.equal(commitLauf(erster.ziel).status, 0)
  assert.equal(git(bare, 'show', 'main:extension/manifest.json'), man('4.32.4'))
  const zweiter2 = flachLauf('flach2', vorPush)
  assert.match(zweiter2.stdout, /unverändert \(kein ausgelieferter/, 'der Lauf nach dem Zähler-Push findet nichts, trotz altem Vor-Push-Stand')
  // Nur die Manifest-Datei wird committet, nichts anderes aus der Arbeitskopie
  const k0 = klon('k0')
  writeFileSync(join(k0, 'extension/manifest.json'), man('4.32.9'))
  writeFileSync(join(k0, 'extension/a.js'), 'unrelated\n')
  assert.equal(commitLauf(k0).status, 0)
  assert.equal(git(bare, 'show', 'main:extension/a.js'), 'B\n', 'fremde Änderung der Arbeitskopie bleibt draußen')
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
