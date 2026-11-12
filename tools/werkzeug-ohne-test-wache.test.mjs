/** Gegenprobe zu `tools/werkzeug-ohne-test-wache.mjs`: Aufruf `node tools/werkzeug-ohne-test-wache.test.mjs`. */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { eintraege, istWerkzeug, neueFreigaben, ohneTest, pruefe } from './werkzeug-ohne-test-wache.mjs'

const WACHE = join(dirname(fileURLToPath(import.meta.url)), 'werkzeug-ohne-test-wache.mjs')
const lauf = (dateien, { bekannt = '', frei = '', basis = null } = {}) =>
  pruefe({ dateien: new Map(Object.entries(dateien)), bekanntText: bekannt, freigabeText: frei, basis })
let faelle = 0
const pruefeFall = (name, dateien, erwartet, optionen) => {
  faelle += 1
  const fehler = lauf(dateien, optionen)
  assert.equal(fehler.length, erwartet, `${name}: ${fehler.join(' | ')}`)
  console.log(`  ✓ ${name}`)
}
const GRUND = 'Handwerkzeug ohne Netz'

for (const pfad of ['tools/a.mjs', 'tools/a.cjs', 'tools/a.js', 'tools/a.ts', 'tools/a.mts', 'tools/lib/a.mjs']) assert.equal(istWerkzeug(pfad), true, pfad)
for (const pfad of ['tools/a.test.mjs', 'tools/a.d.ts', 'tools/archiv/a.mjs', 'tools/a.json', 'tools/a.sh', 'pipeline/a.ts', 'web/src/a.ts']) assert.equal(istWerkzeug(pfad), false, pfad)

pruefeFall('Werkzeug ohne Test und ohne Eintrag ist rot', { 'tools/a.mjs': '1' }, 1)
pruefeFall('Eintrag im Altbestand genügt', { 'tools/a.mjs': '1' }, 0, { bekannt: `tools/a.mjs # ${GRUND}`, basis: new Set(['tools/a.mjs']) })
pruefeFall('Freigabe mit Grund genügt', { 'tools/a.mjs': '1' }, 0, { frei: `tools/a.mjs # ${GRUND}` })
pruefeFall('Grund mit zwei Wörtern ist rot', { 'tools/a.mjs': '1' }, 1, { frei: 'tools/a.mjs # nur Handwerkzeug' })
pruefeFall('Grund „a“ ist rot', { 'tools/a.mjs': '1' }, 1, { frei: 'tools/a.mjs # a' })
pruefeFall('Grund mit genau drei Wörtern ist grün', { 'tools/a.mjs': '1' }, 0, { frei: 'tools/a.mjs # drei kurze Wörter' })
pruefeFall('Name nur im String eines Tests zählt (dokumentierte Grenze)', { 'tools/a.mjs': '1', 'tools/y.test.mjs': 'console.log("a.mjs")' }, 0, { bekannt: '' , frei: '' })
{
  const frei = eintraege('tools/a.mjs # drei kurze Wörter\ntools/b.mjs # drei kurze Wörter')
  assert.deepEqual(neueFreigaben(frei, new Set(['tools/b.mjs'])), ['tools/a.mjs'], 'Umzug Altbestand → Freigabe: neu gegenüber der Basis')
  assert.deepEqual(neueFreigaben(frei, new Set(['tools/a.mjs', 'tools/b.mjs'])), [], 'schon auf main')
  assert.deepEqual(neueFreigaben(frei, null), [], 'ohne Basis keine Aussage')
  console.log('  ✓ neueFreigaben')
}
pruefeFall('Eintrag ohne Grund ist rot', { 'tools/a.mjs': '1' }, 1, { frei: 'tools/a.mjs' })
pruefeFall('Altbestand ohne Grund ist rot', { 'tools/a.mjs': '1' }, 1, { bekannt: 'tools/a.mjs #', basis: new Set(['tools/a.mjs']) })
pruefeFall('Kommentarzeilen der Listen zählen nicht', { 'tools/a.mjs': '1' }, 0, { bekannt: `# Kopf\n\ntools/a.mjs # ${GRUND}` })

pruefeFall('Test mit dem Dateinamen zählt', { 'tools/a.mjs': '1', 'tools/a.test.mjs': "import './a.mjs'" }, 0)
pruefeFall('pipeline/check-* zählt als Test', { 'tools/a.mjs': '1', 'pipeline/check-a.ts': "import '../tools/a.mjs'" }, 0)
pruefeFall('Name nur im Kommentar des Tests zählt nicht', { 'tools/a.mjs': '1', 'tools/b.test.mjs': '// a.mjs\n/* a.mjs */\n1' }, 1)
pruefeFall('Name als Teil eines anderen Namens zählt nicht', { 'tools/a.mjs': '1', 'tools/b.test.mjs': "import './xa.mjs'" }, 1)
pruefeFall('Zeile der Kettenliste zählt', { 'tools/a.mjs': '1', 'tools/check-logic-liste.txt': 'tools/a.mjs\n' }, 0)
pruefeFall('Kommentarzeile der Kettenliste zählt nicht', { 'tools/a.mjs': '1', 'tools/check-logic-liste.txt': '# tools/a.mjs\n' }, 1)
pruefeFall('Kommentar hinter der Listenzeile zählt nicht', { 'tools/a.mjs': '1', 'tools/check-logic-liste.txt': 'tools/c.mjs # a.mjs\n' }, 1)
pruefeFall('Bestandsliste zählt', { 'tools/a.mjs': '1', 'tools/check-bestand-liste.txt': 'tools/a.mjs\n' }, 0)
pruefeFall('ein anderes Werkzeug ist kein Test', { 'tools/a.mjs': '1', 'tools/b.mjs': "import './a.mjs'" }, 2)

pruefeFall('Altbestand-Eintrag, jetzt getestet, ist rot (streichen)', { 'tools/a.mjs': '1', 'tools/a.test.mjs': "import './a.mjs'" }, 1, { bekannt: `tools/a.mjs # ${GRUND}`, basis: new Set(['tools/a.mjs']) })
pruefeFall('Freigabe-Eintrag, jetzt getestet, ist rot (streichen)', { 'tools/a.mjs': '1', 'tools/a.test.mjs': "import './a.mjs'" }, 1, { frei: `tools/a.mjs # ${GRUND}` })
pruefeFall('Eintrag einer fehlenden Datei ist rot', {}, 1, { bekannt: `tools/weg.mjs # ${GRUND}`, basis: new Set(['tools/weg.mjs']) })
pruefeFall('neuer Altbestand-Eintrag gegen die Basis ist rot', { 'tools/a.mjs': '1' }, 1, { bekannt: `tools/a.mjs # ${GRUND}`, basis: new Set() })
pruefeFall('ohne Basis gilt die eigene Datei', { 'tools/a.mjs': '1' }, 0, { bekannt: `tools/a.mjs # ${GRUND}`, basis: null })
pruefeFall('Basis mit mehr Einträgen (Schrumpfen) ist grün', { 'tools/a.mjs': '1' }, 0, { bekannt: `tools/a.mjs # ${GRUND}`, basis: new Set(['tools/a.mjs', 'tools/b.mjs']) })
assert.deepEqual(ohneTest(new Map([['tools/b.mjs', '1'], ['tools/a.mjs', '1']])), ['tools/a.mjs', 'tools/b.mjs'], 'sortiert')

// Prozess im Wegwerf-Repo: Exit-Code und Schlusszeile.
const wurzel = mkdtempSync(join(tmpdir(), 'ohne-test-'))
const git = (...a) => execFileSync('git', a, { cwd: wurzel, windowsHide: true, timeout: 60000, stdio: 'ignore' })
const schreibe = (pfad, text) => {
  mkdirSync(dirname(join(wurzel, pfad)), { recursive: true })
  writeFileSync(join(wurzel, pfad), text)
}
// Das Ereignis setzt nur der Fall, der es will (die echte Kette setzt es im PR).
const fahre = (ereignis = '') => spawnSync(process.execPath, [WACHE, wurzel], { encoding: 'utf8', timeout: 60000, windowsHide: true, env: { ...process.env, GITHUB_EVENT_NAME: ereignis } })
try {
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 'a@b.c')
  git('config', 'user.name', 'x')
  schreibe('tools/a.mjs', '1\n')
  schreibe('tools/b.mjs', '1\n')
  schreibe('tools/b.test.mjs', "import './b.mjs'\n")
  schreibe('tools/werkzeug-ohne-test-bekannt.txt', `tools/a.mjs # ${GRUND}\n`)
  schreibe('tools/werkzeug-ohne-test-freigabe.txt', '')
  git('add', '-A')
  git('commit', '-q', '-m', 'x')
  git('update-ref', 'refs/remotes/origin/main', 'HEAD')

  let r = fahre()
  assert.equal(r.status, 0, r.stderr + r.stdout)
  assert.match(r.stdout, /1 von 2 Werkzeugen unter tools\/ ohne Test/)
  assert.doesNotMatch(r.stdout, /WARNUNG/, 'Basis erreichbar')
  console.log('  ✓ Prozess: grün, Schlusszeile mit Zahl')

  r = fahre('pull_request')
  assert.equal(r.status, 1, 'PR-Ereignis ohne Merge-Commit: kein Urteil möglich, rot')
  assert.match(r.stderr, /kein Urteil möglich/)
  console.log('  ✓ Prozess: PR-Ereignis ohne Merge-Commit ist rot (kein stilles Warnen)')

  schreibe('tools/c.mjs', '1\n')
  r = fahre()
  assert.equal(r.status, 1, 'neues Werkzeug ohne Test')
  assert.match(r.stderr, /tools\/c\.mjs hat keinen Test/)
  schreibe('tools/werkzeug-ohne-test-freigabe.txt', `tools/c.mjs # ${GRUND}\n`)
  r = fahre()
  assert.equal(r.status, 0, r.stderr + r.stdout)
  assert.match(r.stdout, /⚠ WARNUNG Neue Freigabe: tools\/c\.mjs/)
  console.log('  ✓ Prozess: neues Werkzeug rot, mit Freigabe grün und Warnzeile')

  schreibe('tools/werkzeug-ohne-test-bekannt.txt', `tools/a.mjs # ${GRUND}\ntools/c.mjs # ${GRUND}\n`)
  schreibe('tools/werkzeug-ohne-test-freigabe.txt', '')
  r = fahre()
  assert.equal(r.status, 1, 'Altbestand wächst gegen main')
  assert.match(r.stderr, /darf nur schrumpfen/)
  console.log('  ✓ Prozess: Altbestand wächst gegen main, rot')

  // PR-Ereignis: Basis ist der erste Elternteil des Merge-Commits, nicht origin/main (das hier schon den Zweig trägt).
  git('checkout', '-q', '-b', 'zweig')
  git('add', '-A')
  git('commit', '-q', '-m', 'zweig')
  git('update-ref', 'refs/remotes/origin/main', 'HEAD')
  git('checkout', '-q', 'main')
  git('merge', '--no-ff', '-q', '-m', 'merge', 'zweig')
  r = fahre()
  assert.equal(r.status, 0, 'ohne PR-Ereignis zählt origin/main: ' + r.stderr + r.stdout)
  r = fahre('pull_request')
  assert.equal(r.status, 1, 'im PR-Ereignis zählt HEAD^1')
  assert.match(r.stderr, /tools\/c\.mjs ist neu auf der Altbestandsliste/)
  console.log('  ✓ Prozess: PR-Ereignis nimmt den ersten Elternteil als Basis')

  // Fehlt die Liste auf der Basis, ist das nur eine Warnung: Merge-Commit mit leerem ersten Elternteil, gleicher Baum.
  const ausgabe = (...a) => execFileSync('git', a, { cwd: wurzel, encoding: 'utf8', windowsHide: true, timeout: 60000 }).trim()
  const leer = ausgabe('commit-tree', '4b825dc642cb6eb9a060e54bf8d69288fbee4904', '-m', 'leer')
  const kopf = ausgabe('rev-parse', 'HEAD')
  git('checkout', '-q', '--detach', ausgabe('commit-tree', `${kopf}^{tree}`, '-p', leer, '-p', kopf, '-m', 'merge ohne Liste'))
  r = fahre('pull_request')
  assert.equal(r.status, 0, 'Liste fehlt auf der Basis: ' + r.stderr + r.stdout)
  assert.match(r.stdout, /⚠ WARNUNG Ratsche-Basis: eigene Datei/)
  git('checkout', '-q', 'main')
  console.log('  ✓ Prozess: Liste fehlt auf der Basis im PR-Ereignis, nur Warnung')

  git('update-ref', '-d', 'refs/remotes/origin/main')
  r = fahre()
  assert.equal(r.status, 0, r.stderr + r.stdout)
  assert.match(r.stdout, /⚠ WARNUNG Ratsche-Basis: eigene Datei/)
  console.log('  ✓ Prozess: ohne Basis Warnzeile, eigene Datei gilt')

  git('rm', '-q', '-f', 'tools/a.mjs', 'tools/b.mjs', 'tools/c.mjs')
  schreibe('tools/werkzeug-ohne-test-bekannt.txt', '')
  r = fahre()
  assert.equal(r.status, 1, 'keine Werkzeuge')
  assert.match(r.stderr, /0 Werkzeuge gefunden/)
  console.log('  ✓ Prozess: 0 Werkzeuge ist rot (blind)')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
console.log(`werkzeug-ohne-test-wache.test: ${faelle} Fälle in Funktion und 8 im Prozess, alle grün.`)
