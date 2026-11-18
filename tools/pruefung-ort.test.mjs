/**
 * Test für `tools/pruefung-ort.mjs` und seine Verdrahtung (Ort jeder Prüfung, 18.11.2026): die reinen Funktionen als Tabelle, dazu `check-logic-alle.mjs` und
 * `tests-alle.mjs` als Prozesse in einem Wegwerf-Repo (Kopie der Läufer, drei Prüfungen bzw. Tests: eine im PR, eine nur nachts, eine nachts mit `liest: data/c.txt`).
 * Ohne Flag läuft nur die PR-Prüfung, `--nachts` die beiden Nacht-Einträge; im PR-Ereignis (Merge-Commit, `GITHUB_EVENT_NAME=pull_request`) läuft der Nacht-Eintrag mit
 * `liest` mit, sobald der PR `data/c.txt` ändert, bei einer anderen Datei nicht, bei unlesbarem Diff immer; eine rote Nacht-Prüfung macht nur den Nacht-Lauf rot.
 * Aufruf: node tools/pruefung-ort.test.mjs
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { ALLE, beruehrteDateien, leseModus, leseOrt, liestBeruehrtes, nachOrt } from './pruefung-ort.mjs'

const WURZEL = resolve(import.meta.dirname, '..')
const KOPIEN = ['check-logic-alle.mjs', 'tests-alle.mjs', 'tests-teil.mjs', 'arbeiterpool.mjs', 'git-stand-wache.mjs', 'sperre-umgebung.mjs', 'bau-umgebung.mjs', 'bestand-sperre.cjs', 'check-logic-vollstaendig.mjs', 'check-logic-historie.mjs', 'liste-pruefen.mjs', 'pr-basis.mjs', 'tests-liste.mjs', 'pruefung-ort.mjs']

// Reine Funktionen: Modus aus den Argumenten, Lesedateien, Aufteilung nach Ort.
assert.equal(leseModus([]), 'pr')
assert.equal(leseModus(['--alle']), 'pr')
assert.equal(leseModus(['--nachts']), 'nachts')
const LIEST = { liest: ['data/a.json', 'data/ordner/'] }
assert.equal(liestBeruehrtes(LIEST, ['data/a.json']), true, 'Datei gleich')
assert.equal(liestBeruehrtes(LIEST, ['data/a.json.bak']), false, 'Datei per Präfix zählt nicht')
assert.equal(liestBeruehrtes(LIEST, ['data/ordner/x.yaml']), true, 'Ordner als Präfix')
assert.equal(liestBeruehrtes(LIEST, ['data/ordnerx/x.yaml']), false, 'Ordner nur mit Schrägstrich')
assert.equal(liestBeruehrtes(LIEST, ['tools/x.mjs']), false, 'fremde Datei')
assert.equal(liestBeruehrtes(LIEST, []), false, 'nichts berührt')
assert.equal(liestBeruehrtes(LIEST, ALLE), true, 'unlesbarer Diff: läuft mit')
assert.equal(liestBeruehrtes({}, ALLE), false, 'ohne liest nie')
assert.equal(liestBeruehrtes({ liest: [] }, ['data/a.json']), false, 'leere Liste nie')
const ORT = { logik: { b: { ort: 'nachts' }, c: { ort: 'nachts', liest: ['data/c.txt'] }, d: { ort: 'pr' } } }
const ALLE_NAMEN = ['a', 'b', 'c', 'd']
assert.deepEqual(nachOrt(ALLE_NAMEN, ORT, 'logik', 'pr'), ['a', 'd'], 'pr: alles ohne Nacht-Ort, auch ohne Eintrag und mit Ort pr')
assert.deepEqual(nachOrt(ALLE_NAMEN, ORT, 'logik', 'pr', (e) => e, ['data/c.txt']), ['a', 'c', 'd'], 'pr mit berührter Lesedatei: c läuft mit, b (ohne liest) nie')
assert.deepEqual(nachOrt(ALLE_NAMEN, ORT, 'logik', 'pr', (e) => e, ALLE), ['a', 'c', 'd'])
assert.deepEqual(nachOrt(ALLE_NAMEN, ORT, 'logik', 'nachts', (e) => e, ['data/c.txt']), ['b', 'c'], 'nachts: immer alle Nacht-Einträge')
assert.deepEqual(nachOrt(ALLE_NAMEN, ORT, 'tests', 'pr'), ALLE_NAMEN, 'Art ohne Einträge: alles im PR')
assert.deepEqual(nachOrt(['x.test.mjs', 'y.test.mjs'], { tests: { 'tools/y.test.mjs': { ort: 'nachts' } } }, 'tests', 'nachts', (t) => `tools/${t}`), ['y.test.mjs'], 'Name über die Namensfunktion')
assert.deepEqual(leseOrt(join(tmpdir(), 'gibt-es-nicht-ort')), { logik: {}, tests: {} }, 'ohne Datei keine Nacht-Einträge')
assert.deepEqual(beruehrteDateien(WURZEL, {}), [], 'außerhalb des PR-Ereignisses nichts berührt')
assert.equal(beruehrteDateien(join(tmpdir(), 'gibt-es-nicht-ort'), { GITHUB_EVENT_NAME: 'pull_request' }), ALLE, 'unlesbarer Diff: Marke alle')

/** Wegwerf-Repo mit Läufer-Kopien, Prüfliste, Tests und Zuordnung; `rotB` lässt die Nacht-Prüfung und den Nacht-Test scheitern, `ohnePr` lässt die PR-Prüfung weg,
 *  `aendere` = Datei, die ein PR-Zweig ändert und per Merge-Commit hereinkommt (`HEAD^1` = Stand davor); ohne `aendere` bleibt es bei einem einfachen Commit. */
function baueRepo({ rotB = false, ohnePr = false, aendere = null, doppelt = false } = {}) {
  const ordner = mkdtempSync(join(tmpdir(), 'pruefung-ort-'))
  mkdirSync(join(ordner, 'tools'))
  mkdirSync(join(ordner, 'pipeline'))
  mkdirSync(join(ordner, 'data'))
  mkdirSync(join(ordner, '.claude', 'hooks'), { recursive: true })
  for (const k of KOPIEN) copyFileSync(join(WURZEL, 'tools', k), join(ordner, 'tools', k))
  copyFileSync(join(WURZEL, 'package.json'), join(ordner, 'package.json'))
  symlinkSync(join(WURZEL, 'node_modules'), join(ordner, 'node_modules'), 'junction')
  const pruefungen = ['pipeline/check-a-pr.ts', 'pipeline/check-b-nachts.ts', 'pipeline/check-c-liest.ts'].filter((p) => !(ohnePr && p.includes('check-a')))
  const tests = ['a-pr.test.mjs', 'b-nachts.test.mjs', 'c-liest.test.mjs']
  for (const p of pruefungen) writeFileSync(join(ordner, p), p.includes('check-b') && rotB ? 'process.exit(3)\n' : "console.log('still')\n")
  for (const t of tests) writeFileSync(join(ordner, 'tools', t), t.startsWith('b-') && rotB ? 'process.exit(3)\n' : "console.log('still')\n")
  const liste = doppelt ? [...pruefungen, pruefungen.at(-1)] : pruefungen
  writeFileSync(join(ordner, 'tools/check-logic-liste.txt'), `${liste.join('\n')}\n`)
  writeFileSync(join(ordner, 'ausnahmen.json'), JSON.stringify({ hoechstens: 1, ausnahmen: [{ datei: 'pipeline/check-b-nachts.ts', erlaubt: ['public/data/x.json'], bis: '2999-12-31' }] }))
  const eintrag = (liest) => ({ ort: 'nachts', grund: 'g', beleg: 'b', ...(liest ? { liest: ['data/c.txt'] } : {}) })
  const ort = {
    logik: { 'pipeline/check-b-nachts.ts': eintrag(false), 'pipeline/check-c-liest.ts': eintrag(true) },
    tests: { [`tools/${tests[1]}`]: eintrag(false), [`tools/${tests[2]}`]: eintrag(true) },
  }
  writeFileSync(join(ordner, 'tools/pruefung-ort.json'), JSON.stringify(ort))
  writeFileSync(join(ordner, 'data/c.txt'), 'eins\n')
  writeFileSync(join(ordner, 'data/fremd.txt'), 'eins\n')
  writeFileSync(join(ordner, '.gitignore'), 'node_modules\n')
  const git = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: ordner, stdio: 'ignore', timeout: 60_000 })
  git('init', '-q')
  git('branch', '-M', 'haupt')
  git('add', '.')
  git('commit', '-q', '-m', 'a')
  if (aendere) {
    git('checkout', '-q', '-b', 'pr')
    writeFileSync(join(ordner, aendere), 'zwei\n')
    git('commit', '-q', '-a', '-m', 'pr')
    git('checkout', '-q', 'haupt')
    git('merge', '-q', '--no-ff', '-m', 'merge', 'pr')
  }
  return ordner
}

const ordnerListe = []
const lauf = (ordner, skript, args, ereignis = false, extraEnv = {}) => {
  const env = { ...process.env, ...extraEnv }
  delete env.CI
  delete env.GITHUB_EVENT_NAME
  if (ereignis) env.GITHUB_EVENT_NAME = 'pull_request'
  const r = spawnSync(process.execPath, [join(ordner, 'tools', skript), ...args], { cwd: ordner, encoding: 'utf8', env, windowsHide: true, timeout: 120_000 })
  return { status: r.status, text: `${r.stdout}\n${r.stderr}` }
}
const nennt = (text, datei) => text.includes(datei)
/** Fährt beide Läufer; `drin`/`draussen` nennen die Kennungen (a-pr, b-nachts, c-liest), die laufen bzw. nicht laufen. */
function pruefeBeide(ordner, args, ereignis, drin, draussen, titel) {
  const l = lauf(ordner, 'check-logic-alle.mjs', args, ereignis)
  assert.equal(l.status, 0, `check:logic ${titel}: Exit ${l.status}\n${l.text}`)
  const t = lauf(ordner, 'tests-alle.mjs', args, ereignis)
  assert.equal(t.status, 0, `tests-alle ${titel}: Exit ${t.status}\n${t.text}`)
  for (const d of drin) {
    assert.ok(nennt(l.text, `pipeline/check-${d}.ts`), `check:logic ${titel}: ${d} läuft\n${l.text}`)
    assert.ok(nennt(t.text, `tools/${d}.test.mjs`), `tests-alle ${titel}: ${d} läuft\n${t.text}`)
  }
  for (const d of draussen) {
    assert.ok(!nennt(l.text, `pipeline/check-${d}.ts`), `check:logic ${titel}: ${d} läuft nicht\n${l.text}`)
    assert.ok(!nennt(t.text, `tools/${d}.test.mjs`), `tests-alle ${titel}: ${d} läuft nicht\n${t.text}`)
  }
  return { logik: l.text, tests: t.text }
}

try {
  const gut = baueRepo()
  ordnerListe.push(gut)
  // Ohne PR-Ereignis: ohne Flag nur die PR-Prüfung, mit --nachts beide Nacht-Einträge.
  const roh = pruefeBeide(gut, [], false, ['a-pr'], ['b-nachts', 'c-liest'], 'ohne Flag')
  assert.match(roh.logik, /Ort pr, 1 von 3/)
  assert.match(roh.tests, /1 von 1 Tests grün/)
  const nachts = pruefeBeide(gut, ['--nachts'], false, ['b-nachts', 'c-liest'], ['a-pr'], '--nachts')
  assert.match(nachts.logik, /Ort nachts, 2 von 3/)
  assert.match(nachts.tests, /2 von 2 Tests grün/)
  console.log('  ✓ Läufer: ohne Flag nur PR, --nachts beide Nacht-Einträge')

  // PR-Ereignis: ändert der PR die Lesedatei, läuft der Nacht-Eintrag mit liest mit (und nur der), sonst nicht.
  const berührt = baueRepo({ aendere: 'data/c.txt' })
  ordnerListe.push(berührt)
  const mit = pruefeBeide(berührt, [], true, ['a-pr', 'c-liest'], ['b-nachts'], 'PR ändert data/c.txt')
  assert.match(mit.logik, /Nacht-Prüfungen mit berührter Lesedatei laufen im PR mit: pipeline\/check-c-liest\.ts/)
  assert.match(mit.tests, /Nacht-Tests mit berührter Lesedatei laufen im PR mit: c-liest\.test\.mjs/)
  const fremd = baueRepo({ aendere: 'data/fremd.txt' })
  ordnerListe.push(fremd)
  const ohne = pruefeBeide(fremd, [], true, ['a-pr'], ['b-nachts', 'c-liest'], 'PR ändert nur data/fremd.txt')
  assert.doesNotMatch(ohne.logik, /laufen im PR mit/)
  // Dieselbe Änderung ohne PR-Ereignis (lokal) zieht nichts hinein.
  pruefeBeide(berührt, [], false, ['a-pr'], ['b-nachts', 'c-liest'], 'lokal, ohne Ereignis')
  // Diff nicht lesbar (HEAD ist kein Merge-Commit): jeder Nacht-Eintrag mit liest läuft mit, b ohne liest nicht.
  const unlesbar = pruefeBeide(gut, [], true, ['a-pr', 'c-liest'], ['b-nachts'], 'Diff nicht lesbar')
  assert.match(unlesbar.logik, /Diff des PR nicht lesbar/)
  console.log('  ✓ PR-Ereignis: Lesedatei berührt = Nacht-Eintrag läuft mit, sonst nicht, unlesbarer Diff = läuft mit')

  // Rot nur nachts: dieselbe rote Prüfung/derselbe rote Test lässt den PR-Lauf grün und den Nacht-Lauf rot (ohne liest-Eintrag im PR-Diff).
  const rot = baueRepo({ rotB: true })
  ordnerListe.push(rot)
  assert.equal(lauf(rot, 'check-logic-alle.mjs', []).status, 0, 'rote Nacht-Prüfung stört den PR-Lauf nicht')
  assert.notEqual(lauf(rot, 'check-logic-alle.mjs', ['--nachts']).status, 0, 'rote Nacht-Prüfung macht den Nacht-Lauf rot')
  assert.equal(lauf(rot, 'tests-alle.mjs', []).status, 0, 'roter Nacht-Test stört den PR-Lauf nicht')
  assert.notEqual(lauf(rot, 'tests-alle.mjs', ['--nachts']).status, 0, 'roter Nacht-Test macht den Nacht-Lauf rot')
  console.log('  ✓ Rot: nur der Nacht-Lauf wird rot, der PR-Lauf bleibt grün')

  // Steht in der Liste nur Nacht-Zeug, ist der PR-Lauf leer und rot (sonst läuft die Kette still ohne Prüfung).
  const ohnePr = baueRepo({ ohnePr: true })
  ordnerListe.push(ohnePr)
  const p = lauf(ohnePr, 'check-logic-alle.mjs', [])
  assert.equal(p.status, 1, p.text)
  assert.match(p.text, /enthält keine Prüfung/)
  console.log('  ✓ PR-Lauf ohne PR-Prüfung: rot')

  // Prüfungen über die ganze Liste, nicht über die Auswahl: Ein doppelter Nacht-Eintrag fällt auch im PR-Lauf auf (Sortier-/Dublettenregel), und eine Ausnahme
  // (`BESTAND_AUSNAHMEN`) für eine Nacht-Prüfung bricht den PR-Lauf nicht ab („nicht in der Liste“), obwohl die Prüfung dort nicht läuft.
  const doppelt = baueRepo({ doppelt: true })
  ordnerListe.push(doppelt)
  const d = lauf(doppelt, 'check-logic-alle.mjs', [])
  assert.notEqual(d.status, 0, d.text)
  assert.match(d.text, /pipeline\/check-c-liest\.ts steht mehrfach/)
  const ausnahmeRepo = baueRepo()
  ordnerListe.push(ausnahmeRepo)
  const a = lauf(ausnahmeRepo, 'check-logic-alle.mjs', [], false, { BESTAND_AUSNAHMEN: join(ausnahmeRepo, 'ausnahmen.json') })
  assert.equal(a.status, 0, `Ausnahme einer Nacht-Prüfung im PR-Lauf: ${a.text}`)
  console.log('  ✓ Dublette und Ausnahme einer Nacht-Prüfung werden über die ganze Liste geprüft')
  console.log('pruefung-ort: ok (Modus, Lesedateien, Aufteilung, check-logic-alle und tests-alle als Prozess im Merge-Commit, Rot nur nachts)')
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
