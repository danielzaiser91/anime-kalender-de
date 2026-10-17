/**
 * Test für tools/pr-bestand-vergleich.mjs (Schritt „Bestandsprüfungen auf der Bauausgabe“ im Job PR-Datenbau).
 * Kulisse: ein Git-Repo im Temp-Ordner mit drei Rest-Skripten, drei bzw. vier Listenprüfungen (gefahren vom echten tools/check-logic-alle.mjs samt
 * Pool) und einem Bau, der `aus/rot.txt` aus `bau-rot.txt` (getrackt, je Stand anders) und `data/cache/rot.txt` (geteilt) schreibt.
 * Der PR-Bau ist die Datei `aus/rot.txt` im Arbeitsbaum; die Basis ist ein Commit davor.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { appendFileSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { restSkripte } from './pr-bestand-vergleich.mjs'

const tools = dirname(fileURLToPath(import.meta.url))
const wurzel = join(tools, '..')
const skript = join(tools, 'pr-bestand-vergleich.mjs')

// Der Schritt sieht dieselben Prüfungen wie check:bestand im Bestandsbau.
const pkg = JSON.parse(readFileSync(join(wurzel, 'package.json'), 'utf8'))
assert.equal(pkg.scripts['check:bestand'], 'npm run check:bestand-rest && npm run check:bestand-liste')
assert.equal(pkg.scripts['check:bestand-liste'], 'node tools/check-logic-alle.mjs tools/check-bestand-liste.txt check:bestand')
assert.ok(restSkripte(pkg).length >= 10)
assert.throws(
  () =>
    restSkripte({
      scripts: { 'check:bestand-rest': 'npm run a && node b.mjs' },
    }),
  /kein „npm run/,
)
assert.throws(() => restSkripte({ scripts: {} }), /fehlt/)

const k = mkdtempSync(join(tmpdir(), 'pr-bestand-vergleich-'))
const spur = join(k, '..', `${k.split(/[\\/]/).at(-1)}-spur.txt`)
const schreibe = (pfad, text) => {
  mkdirSync(dirname(join(k, pfad)), { recursive: true })
  writeFileSync(join(k, pfad), text)
}
const git = (...args) => {
  const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: k, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  return r.stdout.trim()
}

for (const t of ['check-logic-alle', 'arbeiterpool', 'git-stand-wache', 'check-logic-vollstaendig', 'sperre-umgebung']) {
  schreibe(`tools/${t}.mjs`, '')
  copyFileSync(join(tools, `${t}.mjs`), join(k, `tools/${t}.mjs`))
}
const SPUR_JS = JSON.stringify(spur)
// Der geteilte Cache der Kulisse (im Temp-Repo, kein Eintrag für data/cache-register.json).
const CACHE = 'data/cache'
schreibe(
  'pruefe.mjs',
  `import { appendFileSync, existsSync, readFileSync } from 'node:fs'
export function pruefe(name) {
  const lies = (p) => (existsSync(p) ? readFileSync(p, 'utf8').split(/\\s+/) : [])
  appendFileSync(${SPUR_JS}, (existsSync('ist-pr') ? 'pr:' : 'basis:') + name + '\\n')
  if (lies('aus/schreibt.txt').includes(name)) appendFileSync('getrackt.txt', name + '\\n')
  if (![...lies('aus/rot.txt'), ...lies(${JSON.stringify(`${CACHE}/rot.txt`)})].includes(name)) {
    console.log('  - geprüft ' + name)
    return
  }
  // Wie echte Prüfungen: eine Aufzählung im eigenen Text, die nicht als rote Prüfung gelesen werden darf.
  console.log('  - Verstoß in ' + name)
  process.exit(1)
}
`,
)
schreibe('rest.mjs', "import { pruefe } from './pruefe.mjs'\npruefe(process.argv[2])\n")
for (const d of ['a', 'b', 'bb', 'c']) schreibe(`pruef/${d}.mjs`, `import { pruefe } from '../pruefe.mjs'\npruefe('pruef/${d}.mjs')\n`)
schreibe(
  'bau.mjs',
  `import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
appendFileSync(${SPUR_JS}, 'bau\\n')
if (existsSync('bau-kaputt')) process.exit(1)
mkdirSync('aus', { recursive: true })
writeFileSync('aus/rot.txt', existsSync('bau-rot.txt') ? readFileSync('bau-rot.txt', 'utf8') : '')
`,
)
const restKette = ['r1', 'r2', 'r3'].map((r) => `npm run check:${r}`).join(' && ')
const scripts = {
  'check:bestand-rest': restKette,
  'data:build': 'node bau.mjs',
}
for (const r of ['r1', 'r2', 'r3']) scripts[`check:${r}`] = `node rest.mjs check:${r}`
schreibe('package.json', JSON.stringify({ name: 'k', private: true, type: 'module', scripts }))
schreibe('.gitignore', 'node_modules\naus/\ndata/cache/\nist-pr\n')
schreibe('ist-pr', '')
schreibe(`${CACHE}/marke.txt`, 'bleibt')
schreibe('getrackt.txt', '')
symlinkSync(join(wurzel, 'node_modules'), join(k, 'node_modules'), 'junction')
const LISTE = ['pruef/a.mjs', 'pruef/b.mjs', 'pruef/c.mjs']
git('init', '-q', '-b', 'main')

/** Ein Basis-Commit (bauRot: was der Basisbau rot macht) und darauf der PR-Stand (prListe, prRot = Ausgabe des PR-Baus). */
function fall({ bauRot = [], kaputt = false, cacheRot = [], prListe = LISTE, prRot = [], schreibt = [] }) {
  schreibe('tools/check-bestand-liste.txt', `# Kulisse\n${LISTE.join('\n')}\n`)
  schreibe('bau-rot.txt', bauRot.join('\n'))
  if (kaputt) schreibe('bau-kaputt', '')
  git('add', '-A')
  git('commit', '-q', '--allow-empty', '-m', 'basis')
  const basis = git('rev-parse', 'HEAD')
  rmSync(join(k, 'bau-kaputt'), { force: true })
  schreibe('tools/check-bestand-liste.txt', `${prListe.join('\n')}\n`)
  git('add', '-A')
  git('commit', '-q', '--allow-empty', '-m', 'pr')
  schreibe('aus/rot.txt', prRot.join('\n'))
  schreibe('aus/schreibt.txt', schreibt.join('\n'))
  schreibe(`${CACHE}/rot.txt`, cacheRot.join('\n'))
  writeFileSync(spur, '')
  const r = spawnSync(process.execPath, [skript, basis], {
    cwd: k,
    encoding: 'utf8',
  })
  const zeilen = readFileSync(spur, 'utf8').trim().split('\n').filter(Boolean)
  // Nach jedem Lauf: Worktree entfernt, geteilte Ordner unversehrt.
  assert.equal(git('worktree', 'list').split('\n').length, 1, `Basis-Worktree entfernt: ${git('worktree', 'list')}\n${r.stdout}${r.stderr}`)
  assert.equal(readFileSync(join(k, CACHE, 'marke.txt'), 'utf8'), 'bleibt')
  assert.ok(existsSync(join(wurzel, 'node_modules/tsx/package.json')), 'node_modules unversehrt')
  return {
    status: r.status,
    aus: r.stdout + r.stderr,
    pr: zeilen
      .filter((z) => z.startsWith('pr:'))
      .map((z) => z.slice(3))
      .sort(),
    basis: zeilen
      .filter((z) => z.startsWith('basis:'))
      .map((z) => z.slice(6))
      .sort(),
    gebaut: zeilen.includes('bau'),
  }
}

const ALLE_PR = ['check:r1', 'check:r2', 'check:r3', 'pruef/a.mjs', 'pruef/b.mjs', 'pruef/c.mjs']
try {
  // Alles grün: keine Gegenprobe, jede Prüfung lief.
  let e = fall({ bauRot: ['check:r2'] })
  assert.equal(e.status, 0, e.aus)
  assert.deepEqual(e.pr, ALLE_PR)
  assert.equal(e.gebaut, false, 'ohne Rot kein Basisbau')

  // Geerbt (auf der Basis rot) und neu (auf der Basis grün) zugleich: rot, und nur die neue (mitten in der Liste) steht im Fehler.
  e = fall({
    bauRot: ['check:r2', 'pruef/a.mjs', 'pruef/c.mjs'],
    prRot: ['check:r2', 'pruef/a.mjs', 'pruef/b.mjs', 'pruef/c.mjs'],
  })
  assert.equal(e.status, 1, e.aus)
  assert.deepEqual(e.pr, ALLE_PR, 'nach einer roten Prüfung laufen alle weiteren')
  assert.deepEqual(e.basis, ['check:r2', 'pruef/a.mjs', 'pruef/b.mjs', 'pruef/c.mjs'], 'auf der Basis laufen genau die auf dem PR roten')
  assert.match(e.aus, /::error::.*grün sind: pruef\/b\.mjs\n/)
  for (const g of ['check:r2', 'pruef/a.mjs', 'pruef/c.mjs']) assert.ok(e.aus.includes(`::warning::${g} ist schon auf der Basis`), g)

  // Nur Geerbtes, einmal über den Basisbau, einmal über den geteilten Cache: grün mit Warnungen.
  e = fall({
    bauRot: ['check:r2'],
    cacheRot: ['pruef/b.mjs'],
    prRot: ['check:r2', 'pruef/b.mjs'],
  })
  assert.equal(e.status, 0, e.aus)
  assert.deepEqual(e.pr, ALLE_PR)
  assert.deepEqual(e.basis, ['check:r2', 'pruef/b.mjs'])
  assert.match(e.aus, /::warning::pruef\/b\.mjs ist schon auf der Basis/)
  assert.doesNotMatch(e.aus, /::error::/)

  // Eine Prüfung, die es auf der Basis nicht gibt, ist neu, auch wenn die Basisdaten sie verletzten.
  e = fall({
    bauRot: ['pruef/bb.mjs', 'check:r1'],
    prListe: ['pruef/a.mjs', 'pruef/b.mjs', 'pruef/bb.mjs', 'pruef/c.mjs'],
    prRot: ['check:r1', 'pruef/bb.mjs'],
  })
  assert.equal(e.status, 1, e.aus)
  assert.deepEqual(e.basis, ['check:r1'])
  assert.match(e.aus, /::error::.*grün sind: pruef\/bb\.mjs\n/)

  // Scheitert der Basisbau, zählt jedes Rot.
  e = fall({ kaputt: true, bauRot: ['check:r1'], prRot: ['check:r1'] })
  assert.equal(e.status, 1, e.aus)
  assert.equal(e.gebaut, true)
  assert.deepEqual(e.basis, [])
  assert.match(e.aus, /::error::Der Bau der Basis .* gescheitert/)

  // Rot ohne einzelne Prüfung (Liste unsortiert): zählt als Ganzes und gilt nie als geerbt.
  e = fall({ prListe: ['pruef/b.mjs', 'pruef/a.mjs', 'pruef/c.mjs'] })
  assert.equal(e.status, 1, e.aus)
  assert.deepEqual(e.basis, [])
  assert.match(e.aus, /::error::.*grün sind: check:bestand-liste\n/)

  // Eine Prüfung schreibt ins Repo: rot als Ganzes, allein und neben einer geerbten roten Prüfung.
  e = fall({ schreibt: ['pruef/b.mjs'] })
  assert.equal(e.status, 1, e.aus)
  assert.match(e.aus, /::error::.*grün sind: check:bestand-liste\n/)
  e = fall({ bauRot: ['pruef/c.mjs'], prRot: ['pruef/c.mjs'], schreibt: ['pruef/b.mjs'] })
  assert.equal(e.status, 1, e.aus)
  assert.deepEqual(e.basis, ['pruef/c.mjs'])
  assert.match(e.aus, /::error::.*grün sind: check:bestand-liste\n/)
} finally {
  unlinkSync(join(k, 'node_modules'))
  rmSync(k, { recursive: true, force: true })
  rmSync(spur, { force: true })
}
console.log('pr-bestand-vergleich.test: grün')
