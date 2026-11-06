/**
 * Prüft die Aufteilung von `tools/tests-alle.mjs` auf CI-Jobs (`tools/tests-teil.mjs`):
 * die reine Auswahl (disjunkt, vollständig, langsame Tests abwechselnd), die Verdrahtung im echten Läufer (Wegwerf-Repo mit vier Attrappe-Tests)
 * und die Verdrahtung in package.json und pr-pruefung.yml (jede Hälfte läuft in der Kette, `check:vor-commit` hat dieselben Hälften).
 * Aufruf: `node tools/tests-teil.test.mjs`
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parse } from 'yaml'
import { leseTeil, waehleTeil } from './tests-teil.mjs'

const WURZEL = resolve(import.meta.dirname, '..')

// 1. Argumente
assert.equal(leseTeil(['node', 'x']), null, 'ohne --teil: null (alle Tests)')
assert.deepEqual(leseTeil(['node', 'x', '--teil', '2/3']), { k: 2, n: 3 })
for (const falsch of [[], ['0/2'], ['3/2'], ['a/b'], ['1/'], ['1-2']]) {
  assert.throws(() => leseTeil(['node', 'x', '--teil', ...falsch]), /--teil verlangt k\/n/, `--teil ${falsch[0] ?? '(leer)'} wird abgewiesen`)
}

// 2. Auswahl: disjunkt, vollständig, Reihenfolge erhalten, langsame abwechselnd
const namen = Array.from({ length: 23 }, (_, i) => `t${String(i).padStart(2, '0')}.test.mjs`)
const langsam = ['t20.test.mjs', 't05.test.mjs', 't11.test.mjs', 'fehlt.test.mjs']
for (const n of [1, 2, 3, 5]) {
  const teile = Array.from({ length: n }, (_, i) => waehleTeil(namen, { k: i + 1, n }, langsam))
  assert.deepEqual(teile.flat().sort(), namen, `n=${n}: Teile ergeben zusammen genau alle Tests, ohne Doppelte`)
  for (const t of teile) assert.deepEqual(t, namen.filter((x) => t.includes(x)), `n=${n}: Reihenfolge wie in der Eingabe`)
}
const [eins, zwei] = [1, 2].map((k) => waehleTeil(namen, { k, n: 2 }, langsam))
assert.deepEqual([eins.includes('t20.test.mjs'), zwei.includes('t05.test.mjs'), eins.includes('t11.test.mjs')], [true, true, true], 'langsame Tests wechseln die Hälfte: t20, t05, t11 -> 1, 2, 1')
assert.deepEqual([eins.length, zwei.length], [12, 11], 'Größen 12 und 11')
assert.deepEqual(waehleTeil(namen, { k: 1, n: 1 }, langsam), namen, 'n=1: alle')
assert.notDeepEqual(waehleTeil(namen, { k: 1, n: 2 }, []), eins, 'die Liste der langsamen Tests ändert die Aufteilung (Kontrolle)')

// 3. Läufer: Wegwerf-Repo mit vier Attrappe-Tests (alle Nicht-Test-Dateien aus tools/ kopiert)
const ordner = mkdtempSync(join(tmpdir(), 'tests-teil-'))
try {
  mkdirSync(join(ordner, 'tools'))
  for (const f of readdirSync(join(WURZEL, 'tools'), { withFileTypes: true })) {
    if (f.isFile() && !f.name.includes('.test.') && /\.(mjs|cjs)$/.test(f.name)) copyFileSync(join(WURZEL, 'tools', f.name), join(ordner, 'tools', f.name))
  }
  for (const n of ['a', 'b', 'c', 'd']) writeFileSync(join(ordner, 'tools', `${n}.test.mjs`), `console.log('${n}-lief')\n`)
  writeFileSync(join(ordner, 'package.json'), '{"type":"module"}\n')
  writeFileSync(join(ordner, '.gitignore'), 'node_modules\n')
  const git = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: ordner, stdio: 'ignore', timeout: 60000 })
  git('init', '-q')
  git('add', '.')
  git('commit', '-q', '-m', 'a')
  const lauf = (...args) => spawnSync(process.execPath, [join(ordner, 'tools', 'tests-alle.mjs'), ...args], { cwd: ordner, encoding: 'utf8', timeout: 120000 })
  for (const [k, soll, fehlt] of [[1, ['a', 'c'], ['b', 'd']], [2, ['b', 'd'], ['a', 'c']]]) {
    const r = lauf('--teil', `${k}/2`)
    assert.equal(r.status, 0, `Teil ${k}/2: Exit ${r.status}\n${r.stdout}\n${r.stderr}`)
    for (const n of soll) assert.match(r.stdout, new RegExp(`\\[tests-alle\\] tools/${n}\\.test\\.mjs \\(\\d+\\.\\d s\\)\\n${n}-lief`), `Teil ${k}/2 fährt ${n} (Zeile mit Laufzeit)`)
    for (const n of fehlt) assert.ok(!r.stdout.includes(`${n}-lief`), `Teil ${k}/2 fährt ${n} nicht`)
    assert.match(r.stdout, /tests-alle: Teil \d\/2, 2 von 4 Tests\./, `Teil ${k}/2 nennt seine Größe`)
    assert.match(r.stdout, /tests-alle: 2 von 2 Tests grün\./, `Teil ${k}/2: Schlusszeile`)
  }
  const ganz = lauf()
  assert.equal(ganz.status, 0, ganz.stderr)
  assert.match(ganz.stdout, /tests-alle: 4 von 4 Tests grün\./, 'ohne --teil laufen alle vier')
  const falsch = lauf('--teil', '3/2')
  assert.notEqual(falsch.status, 0, '--teil 3/2: Exit ungleich 0')
  assert.match(falsch.stderr, /--teil verlangt k\/n/, '--teil 3/2: Meldung')
  assert.ok(!falsch.stdout.includes('-lief'), '--teil 3/2: kein Test lief')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}

// 4. package.json und Kette: dieselben Hälften in check:vor-commit und in pr-pruefung.yml, check:workflows (Deploy) bleibt vollständig
const { scripts } = JSON.parse(readFileSync(join(WURZEL, 'package.json'), 'utf8'))
const halbe = Object.entries(scripts).filter(([name]) => /^check:tests-\d+$/.test(name))
assert.deepEqual(halbe.map(([name, befehl]) => [name, befehl]), [['check:tests-1', 'node tools/tests-alle.mjs --teil 1/2'], ['check:tests-2', 'node tools/tests-alle.mjs --teil 2/2']], 'package.json: genau die zwei Hälften 1/2 und 2/2')
assert.equal(scripts['check:workflows'], 'npm run check:wachen && node tools/tests-alle.mjs', 'check:workflows (Deploy, lokal): Wachen und alle Tests')
const vorCommit = scripts['check:vor-commit']
for (const name of ['check:wachen', 'check:tests-1', 'check:tests-2']) assert.ok(vorCommit.includes(`npm run ${name} `), `check:vor-commit enthält ${name}`)
assert.ok(!vorCommit.includes('check:workflows'), 'check:vor-commit nennt check:workflows nicht mehr (sonst liefen die Tests doppelt)')
const jobs = parse(readFileSync(join(WURZEL, '.github/workflows/pr-pruefung.yml'), 'utf8')).jobs
const laeufe = (id) => (jobs[id]?.steps ?? []).map((s) => s.run).filter(Boolean)
assert.deepEqual(laeufe('workflows'), ['npm run check:wachen', 'npm run check:tests-1'], 'Job "Kette – Workflows": Wachen und erste Hälfte')
assert.deepEqual(laeufe('workflows2'), ['npm run check:tests-2'], 'Job "Kette – Workflows 2": zweite Hälfte')
assert.ok(jobs.kette.needs.includes('workflows2'), 'Sammeljob wartet auf Workflows 2')
console.log('tests-teil.test: ok (Auswahl n=1,2,3,5, Läufer Teil 1/2 und 2/2, Verdrahtung package.json und Kette)')
