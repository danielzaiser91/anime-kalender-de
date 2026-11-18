/**
 * Test für `tools/pruefung-ort.mjs` und seine Verdrahtung (Ort jeder Prüfung, 18.11.2026): die reinen Funktionen als Tabelle, dazu `check-logic-alle.mjs` und
 * `tests-alle.mjs` als Prozesse in einem Wegwerf-Repo (Kopie der Läufer, drei Prüfungen bzw. Tests: eine im PR, eine nur nachts, eine nachts mit `deploy: true`).
 * Ohne Flag läuft nur die PR-Prüfung, `--nachts` die beiden Nacht-Einträge, `--nachts-deploy` nur den mit `deploy: true`; eine rote Nacht-Prüfung macht nur den Nacht-Lauf rot.
 * Aufruf: node tools/pruefung-ort.test.mjs
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { leseModus, leseOrt, nachOrt } from './pruefung-ort.mjs'

const WURZEL = resolve(import.meta.dirname, '..')
const KOPIEN = ['check-logic-alle.mjs', 'tests-alle.mjs', 'tests-teil.mjs', 'arbeiterpool.mjs', 'git-stand-wache.mjs', 'sperre-umgebung.mjs', 'bau-umgebung.mjs', 'bestand-sperre.cjs', 'check-logic-vollstaendig.mjs', 'check-logic-historie.mjs', 'liste-pruefen.mjs', 'pr-basis.mjs', 'tests-liste.mjs', 'pruefung-ort.mjs']

// Reine Funktionen: Modus aus den Argumenten, Aufteilung nach Ort.
assert.equal(leseModus([]), 'pr')
assert.equal(leseModus(['--alle']), 'pr')
assert.equal(leseModus(['--nachts']), 'nachts')
assert.equal(leseModus(['--nachts-deploy']), 'deploy')
const ORT = { logik: { b: { ort: 'nachts', deploy: false }, c: { ort: 'nachts', deploy: true }, d: { ort: 'pr' } } }
const ALLE = ['a', 'b', 'c', 'd']
assert.deepEqual(nachOrt(ALLE, ORT, 'logik', 'pr'), ['a', 'd'], 'pr: alles ohne Nacht-Ort, auch ohne Eintrag und mit Ort pr')
assert.deepEqual(nachOrt(ALLE, ORT, 'logik', 'nachts'), ['b', 'c'])
assert.deepEqual(nachOrt(ALLE, ORT, 'logik', 'deploy'), ['c'], 'deploy: nur Nacht-Einträge mit deploy: true')
assert.deepEqual(nachOrt(ALLE, ORT, 'tests', 'pr'), ALLE, 'Art ohne Einträge: alles im PR')
assert.deepEqual(nachOrt(['x.test.mjs', 'y.test.mjs'], { tests: { 'tools/y.test.mjs': { ort: 'nachts', deploy: false } } }, 'tests', 'nachts', (t) => `tools/${t}`), ['y.test.mjs'], 'Name über die Namensfunktion')
assert.deepEqual(leseOrt(join(tmpdir(), 'gibt-es-nicht-ort')), { logik: {}, tests: {} }, 'ohne Datei keine Nacht-Einträge')

/** Wegwerf-Repo mit Läufer-Kopien, Prüfliste, Tests und Zuordnung; `rotB` lässt die Nacht-Prüfung und den Nacht-Test scheitern, `ohneDeploy` streicht `deploy: true`. */
function baueRepo({ rotB = false, ohneDeploy = false, ohnePr = false } = {}) {
  const ordner = mkdtempSync(join(tmpdir(), 'pruefung-ort-'))
  mkdirSync(join(ordner, 'tools'))
  mkdirSync(join(ordner, 'pipeline'))
  mkdirSync(join(ordner, '.claude', 'hooks'), { recursive: true })
  for (const k of KOPIEN) copyFileSync(join(WURZEL, 'tools', k), join(ordner, 'tools', k))
  copyFileSync(join(WURZEL, 'package.json'), join(ordner, 'package.json'))
  symlinkSync(join(WURZEL, 'node_modules'), join(ordner, 'node_modules'), 'junction')
  const pruefungen = ['pipeline/check-a-pr.ts', 'pipeline/check-b-nachts.ts', 'pipeline/check-c-deploy.ts'].filter((p) => !(ohnePr && p.includes('check-a')))
  const tests = ['a-pr.test.mjs', 'b-nachts.test.mjs', 'c-deploy.test.mjs']
  for (const p of pruefungen) writeFileSync(join(ordner, p), p.includes('check-b') && rotB ? 'process.exit(3)\n' : "console.log('still')\n")
  for (const t of tests) writeFileSync(join(ordner, 'tools', t), t.startsWith('b-') && rotB ? 'process.exit(3)\n' : "console.log('still')\n")
  writeFileSync(join(ordner, 'tools/check-logic-liste.txt'), `${pruefungen.join('\n')}\n`)
  const eintrag = (deploy) => ({ ort: 'nachts', grund: 'g', beleg: 'b', deploy: deploy && !ohneDeploy })
  const ort = {
    logik: { [pruefungen[1]]: eintrag(false), [pruefungen[2]]: eintrag(true) },
    tests: { [`tools/${tests[1]}`]: eintrag(false), [`tools/${tests[2]}`]: eintrag(true) },
  }
  writeFileSync(join(ordner, 'tools/pruefung-ort.json'), JSON.stringify(ort))
  writeFileSync(join(ordner, '.gitignore'), 'node_modules\n')
  const git = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: ordner, stdio: 'ignore', timeout: 60_000 })
  git('init', '-q')
  git('add', '.')
  git('commit', '-q', '-m', 'a')
  return ordner
}

const ordnerListe = []
const lauf = (ordner, skript, args) => {
  const env = { ...process.env }
  delete env.CI
  const r = spawnSync(process.execPath, [join(ordner, 'tools', skript), ...args], { cwd: ordner, encoding: 'utf8', env, windowsHide: true, timeout: 120_000 })
  return { status: r.status, text: `${r.stdout}\n${r.stderr}` }
}
const nennt = (text, datei) => text.includes(datei)

try {
  const gut = baueRepo()
  ordnerListe.push(gut)
  // Prüfungen: Ort pr, nachts, deploy; „1 von 3“ nennt die Aufteilung im Log.
  const logik = [
    [[], 'pr', ['check-a-pr'], ['check-b-nachts', 'check-c-deploy'], /Ort pr, 1 von 3/],
    [['--nachts'], 'nachts', ['check-b-nachts', 'check-c-deploy'], ['check-a-pr'], /Ort nachts, 2 von 3/],
    [['--nachts-deploy'], 'deploy', ['check-c-deploy'], ['check-a-pr', 'check-b-nachts'], /Ort deploy, 1 von 3/],
  ]
  for (const [args, name, drin, draussen, kopf] of logik) {
    const r = lauf(gut, 'check-logic-alle.mjs', args)
    assert.equal(r.status, 0, `check:logic ${name}: Exit ${r.status}\n${r.text}`)
    assert.match(r.text, kopf, `check:logic ${name}: Kopfzeile`)
    for (const d of drin) assert.ok(nennt(r.text, `[check:logic`) && nennt(r.text, `pipeline/${d}.ts`), `check:logic ${name}: ${d} läuft`)
    for (const d of draussen) assert.ok(!nennt(r.text, `pipeline/${d}.ts`), `check:logic ${name}: ${d} läuft nicht`)
  }
  const tests = [
    [[], 'pr', ['a-pr'], ['b-nachts', 'c-deploy'], /1 von 1 Tests grün/],
    [['--nachts'], 'nachts', ['b-nachts', 'c-deploy'], ['a-pr'], /2 von 2 Tests grün/],
    [['--nachts-deploy'], 'deploy', ['c-deploy'], ['a-pr', 'b-nachts'], /1 von 1 Tests grün/],
  ]
  for (const [args, name, drin, draussen, schluss] of tests) {
    const r = lauf(gut, 'tests-alle.mjs', args)
    assert.equal(r.status, 0, `tests-alle ${name}: Exit ${r.status}\n${r.text}`)
    assert.match(r.text, schluss, `tests-alle ${name}: Schlusszeile`)
    for (const d of drin) assert.ok(nennt(r.text, `tools/${d}.test.mjs`), `tests-alle ${name}: ${d} läuft`)
    for (const d of draussen) assert.ok(!nennt(r.text, `tools/${d}.test.mjs`), `tests-alle ${name}: ${d} läuft nicht`)
  }
  console.log('  ✓ Läufer: ohne Flag nur PR, --nachts beide Nacht-Einträge, --nachts-deploy nur deploy: true')

  // Rot nur nachts: dieselbe rote Prüfung/derselbe rote Test lässt den PR-Lauf grün und den Nacht-Lauf rot.
  const rot = baueRepo({ rotB: true })
  ordnerListe.push(rot)
  assert.equal(lauf(rot, 'check-logic-alle.mjs', []).status, 0, 'rote Nacht-Prüfung stört den PR-Lauf nicht')
  assert.notEqual(lauf(rot, 'check-logic-alle.mjs', ['--nachts']).status, 0, 'rote Nacht-Prüfung macht den Nacht-Lauf rot')
  assert.equal(lauf(rot, 'check-logic-alle.mjs', ['--nachts-deploy']).status, 0, 'rote Nacht-Prüfung ohne deploy: true stört den Deploy-Lauf nicht')
  assert.equal(lauf(rot, 'tests-alle.mjs', []).status, 0, 'roter Nacht-Test stört den PR-Lauf nicht')
  assert.notEqual(lauf(rot, 'tests-alle.mjs', ['--nachts']).status, 0, 'roter Nacht-Test macht den Nacht-Lauf rot')
  assert.equal(lauf(rot, 'tests-alle.mjs', ['--nachts-deploy']).status, 0, 'roter Nacht-Test ohne deploy: true stört den Deploy-Lauf nicht')
  console.log('  ✓ Rot: nur der Nacht-Lauf wird rot, PR- und Deploy-Lauf bleiben grün')

  // Ohne Eintrag mit deploy: true ist der Deploy-Lauf leer und grün (kein Abbruch „enthält keine Prüfung“).
  const leer = baueRepo({ ohneDeploy: true })
  ordnerListe.push(leer)
  const l = lauf(leer, 'check-logic-alle.mjs', ['--nachts-deploy'])
  assert.equal(l.status, 0, l.text)
  assert.match(l.text, /keine Prüfung mit Ort deploy/)
  assert.equal(lauf(leer, 'tests-alle.mjs', ['--nachts-deploy']).status, 0, 'Tests ohne deploy-Eintrag: leerer Lauf ist grün')
  console.log('  ✓ Deploy-Lauf ohne deploy-Eintrag: leer und grün')

  // Nur der leere Deploy-Lauf ist grün: steht in der Liste nur Nacht-Zeug, ist der PR-Lauf leer und rot (sonst läuft die Kette still ohne Prüfung).
  const ohnePr = baueRepo({ ohnePr: true })
  ordnerListe.push(ohnePr)
  const p = lauf(ohnePr, 'check-logic-alle.mjs', [])
  assert.equal(p.status, 1, p.text)
  assert.match(p.text, /enthält keine Prüfung/)
  console.log('  ✓ PR-Lauf ohne PR-Prüfung: rot')
  console.log('pruefung-ort: ok (Modus, Aufteilung, check-logic-alle und tests-alle als Prozess, Rot nur nachts, leerer Deploy-Lauf)')
} finally {
  for (const o of ordnerListe) {
    try {
      unlinkSync(join(o, 'node_modules'))
    } catch (fehler) {
      if (fehler.code !== 'ENOENT') throw fehler // fehlt der Link (baueRepo früh gescheitert), darf das den eigentlichen Fehler nicht verdecken
    }
    rmSync(o, { recursive: true, force: true })
  }
}
