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
import { teileListenAusgabe, trenneGeerbtUndNeu, zaehleOderMelde, zaehleVerstoesse } from './pr-bestand-zaehlen.mjs'

const tools = dirname(fileURLToPath(import.meta.url))
const wurzel = join(tools, '..')
const skript = join(tools, 'pr-bestand-vergleich.mjs')

// Der Schritt sieht dieselben Prüfungen wie check:bestand im Bestandsbau.
const pkg = JSON.parse(readFileSync(join(wurzel, 'package.json'), 'utf8'))
assert.ok(pkg.scripts['check:bestand'].endsWith(' && npm run check:bestand-liste'))
assert.equal(pkg.scripts['check:bestand-liste'], 'node tools/check-logic-alle.mjs tools/check-bestand-liste.txt check:bestand')
assert.ok(restSkripte(pkg).length >= 10)
assert.ok(!restSkripte(pkg).includes('check:bestand-liste'))
assert.throws(
  () =>
    restSkripte({
      scripts: { 'check:bestand': 'npm run a && node b.mjs' },
    }),
  /kein „npm run/,
)
assert.throws(() => restSkripte({ scripts: {} }), /fehlt/)

// Zählregel (tools/pr-bestand-zaehlen.mjs): nur die Zeile „VERSTÖSSE: n“ zählt.
assert.equal(zaehleVerstoesse('FEHLER: 2 Einträge:\nA\nB\nVERSTÖSSE: 2\n'), 2)
assert.equal(zaehleVerstoesse('> x\nnpm error code 1\n  - Verstoß\nVERSTÖSSE: 11\r\nnpm error\n'), 11)
assert.equal(zaehleVerstoesse('✓ gut\nVERSTÖSSE: 0'), 0)
assert.equal(zaehleVerstoesse('VERSTÖSSE: 5'), 5)
// Fehlt die Zeile oder steht sie mehrfach/verformt, wirft die Zählung (nie 0 annehmen).
for (const schlecht of ['', 'FEHLER: x\nA\nB', 'VERSTÖSSE: 1\nVERSTÖSSE: 1', ' VERSTÖSSE: 1', 'Verstöße: 1', 'VERSTÖSSE: x', 'VERSTÖSSE: 1 weitere', 'VERSTÖSSE:']) assert.throws(() => zaehleVerstoesse(schlecht), /„VERSTÖSSE: <n>“ (fehlt|steht 2-mal) in der Ausgabe/, schlecht)
assert.throws(() => zaehleVerstoesse('VERSTÖSSE: 1\nVERSTÖSSE: 1'), /steht 2-mal/)
assert.throws(() => zaehleVerstoesse('a'), /fehlt/)
const meldungen = []
assert.ok(Number.isNaN(zaehleOderMelde("x.ts", "ohne", (m) => meldungen.push(m))))
assert.deepEqual(meldungen, ['::error::x.ts: Zeile „VERSTÖSSE: <n>“ fehlt in der Ausgabe der Prüfung'])
assert.equal(zaehleOderMelde('x.ts', 'VERSTÖSSE: 3', () => assert.fail('keine Meldung')), 3)
const geteilt = teileListenAusgabe('Kopf\n[check:bestand 1/2] a.ts\nx\ny\n[check:bestand 2/2] b.ts\nz\ncheck:bestand: 1 von 2 Prüfungen rot:\n  - b.ts\n--- b.ts (Exit 1)\n')
assert.deepEqual([...geteilt], [['a.ts', 'x\ny'], ['b.ts', 'z']])
assert.deepEqual(trenneGeerbtUndNeu(new Map([['a', 2], ['b', 3], ['c', 1], ['d', 1]]), new Map([['a', 2], ['b', 2], ['d', 5]])), { geerbt: ['a', 'd'], neu: ['b', 'c'] })

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

// Werkzeugkopie: check-logic-alle.mjs samt allen relativen Importen (rekursiv), damit neue Hilfsdateien nicht an einer festen Liste hängen.
const importiert = (datei) => [...readFileSync(join(tools, datei), 'utf8').matchAll(/from '\.\/([\w.-]+\.mjs)'/g)].map((m) => m[1])
const zuKopieren = new Set(['check-logic-alle.mjs'])
for (const datei of zuKopieren) for (const i of importiert(datei)) zuKopieren.add(i)
for (const datei of zuKopieren) {
  schreibe(`tools/${datei}`, '')
  copyFileSync(join(tools, datei), join(k, `tools/${datei}`))
}
assert.ok(zuKopieren.has('liste-pruefen.mjs') && zuKopieren.has('arbeiterpool.mjs'), 'Importkette von check-logic-alle.mjs unvollständig gelesen')
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
  // Ein Name, der n-mal in der Rotliste steht, meldet n Verstöße (je eine Zeile).
  const zahl = [...lies('aus/rot.txt'), ...lies(${JSON.stringify(`${CACHE}/rot.txt`)})].filter((n) => n === name).length
  // Ein Name in ohne-zeile.txt lässt die Schlusszeile weg (Prüfung ohne das Ausgabeformat).
  const ohneZeile = lies(${JSON.stringify(`${CACHE}/ohne-zeile.txt`)}).includes(name)
  if (zahl === 0) {
    console.log('  - geprüft ' + name)
    if (!ohneZeile) console.log('VERSTÖSSE: 0')
    return
  }
  // Wie echte Prüfungen: Ausgabezeilen im eigenen Text, die nicht mitzählen; gezählt wird nur die Schlusszeile.
  for (let i = 1; i <= 7; i++) console.log('  - Verstoß ' + i + ' in ' + name)
  if (!ohneZeile) console.log('VERSTÖSSE: ' + zahl)
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
/** package.json der Kulisse mit den gegebenen Rest-Skripten (der PR-Commit kann eines mehr haben als die Basis). */
function paket(rest) {
  const scripts = {
    'check:bestand': `${rest.map((r) => `npm run check:${r}`).join(' && ')} && npm run check:bestand-liste`,
    'data:build': 'node bau.mjs',
  }
  for (const r of rest) scripts[`check:${r}`] = `node rest.mjs check:${r}`
  return JSON.stringify({ name: 'k', private: true, type: 'module', scripts })
}
const REST = ['r1', 'r2', 'r3']
schreibe('package.json', paket(REST))
schreibe('.gitignore', 'node_modules\naus/\ndata/cache/\nist-pr\n')
schreibe('ist-pr', '')
schreibe(`${CACHE}/marke.txt`, 'bleibt')
schreibe('getrackt.txt', '')
symlinkSync(join(wurzel, 'node_modules'), join(k, 'node_modules'), 'junction')
const LISTE = ['pruef/a.mjs', 'pruef/b.mjs', 'pruef/c.mjs']
git('init', '-q', '-b', 'main')

/** Ein Basis-Commit (bauRot: was der Basisbau rot macht) und darauf der PR-Stand (prListe, prRot = Ausgabe des PR-Baus). */
function fall({ bauRot = [], kaputt = false, cacheRot = [], prListe = LISTE, prRot = [], schreibt = [], restNeu = [], ohneZeile = [] }) {
  schreibe('package.json', paket(REST))
  schreibe('tools/check-bestand-liste.txt', `# Kulisse\n${LISTE.join('\n')}\n`)
  schreibe('bau-rot.txt', bauRot.join('\n'))
  if (kaputt) schreibe('bau-kaputt', '')
  git('add', '-A')
  git('commit', '-q', '--allow-empty', '-m', 'basis')
  const basis = git('rev-parse', 'HEAD')
  rmSync(join(k, 'bau-kaputt'), { force: true })
  schreibe('tools/check-bestand-liste.txt', `${prListe.join('\n')}\n`)
  schreibe('package.json', paket([...REST, ...restNeu]))
  git('add', '-A')
  git('commit', '-q', '--allow-empty', '-m', 'pr')
  schreibe('aus/rot.txt', prRot.join('\n'))
  schreibe('aus/schreibt.txt', schreibt.join('\n'))
  schreibe(`${CACHE}/rot.txt`, cacheRot.join('\n'))
  schreibe(`${CACHE}/ohne-zeile.txt`, ohneZeile.join('\n'))
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
  assert.match(e.aus, /::error::.*weniger verletzt sind: pruef\/b\.mjs\n/)
  for (const g of ['check:r2', 'pruef/a.mjs', 'pruef/c.mjs']) assert.ok(e.aus.includes(`::warning::${g} ist schon auf der Basis`), g)

  // Nur Geerbtes, einmal über den Basisbau, einmal über den geteilten Cache: grün mit Warnungen.
  e = fall({
    bauRot: ['check:r2'],
    cacheRot: ['pruef/b.mjs'],
    prRot: ['check:r2'],
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
  assert.match(e.aus, /::error::.*weniger verletzt sind: pruef\/bb\.mjs\n/)

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
  assert.match(e.aus, /::error::.*weniger verletzt sind: check:bestand-liste\n/)

  // Eine Prüfung schreibt ins Repo: rot als Ganzes, allein und neben einer geerbten roten Prüfung.
  e = fall({ schreibt: ['pruef/b.mjs'] })
  assert.equal(e.status, 1, e.aus)
  assert.match(e.aus, /::error::.*weniger verletzt sind: check:bestand-liste\n/)
  e = fall({ bauRot: ['pruef/c.mjs'], prRot: ['pruef/c.mjs'], schreibt: ['pruef/b.mjs'] })
  assert.equal(e.status, 1, e.aus)
  assert.deepEqual(e.basis, ['pruef/c.mjs'])
  assert.match(e.aus, /::error::.*weniger verletzt sind: check:bestand-liste\n/)

  // Zahl der Verstöße (25.10.2026): gleich viele oder weniger als auf der Basis = geerbt (Warnung), mehr = rot; Rest-Skript und Listenprüfung je.
  const zwei = ['pruef/b.mjs', 'pruef/b.mjs']
  e = fall({ bauRot: zwei, prRot: zwei })
  assert.equal(e.status, 0, e.aus)
  assert.match(e.aus, /::warning::pruef\/b\.mjs ist schon auf der Basis/)
  e = fall({ bauRot: [...zwei, 'check:r2', 'check:r2'], prRot: [...zwei, 'check:r2'] })
  assert.equal(e.status, 0, `weniger Verstöße als die Basis: ${e.aus}`)
  e = fall({ bauRot: zwei, prRot: [...zwei, 'pruef/b.mjs'] })
  assert.equal(e.status, 1, e.aus)
  assert.match(e.aus, /::error::.*verletzt sind: pruef\/b\.mjs\n/)
  assert.doesNotMatch(e.aus, /::warning::/)
  e = fall({ bauRot: ['check:r2', 'check:r2'], prRot: ['check:r2', 'check:r2', 'check:r2'] })
  assert.equal(e.status, 1, e.aus)
  assert.match(e.aus, /::error::.*verletzt sind: check:r2\n/)
  // Ein neuer Verstoß neben einer gleich gebliebenen geerbten Prüfung: nur die mit mehr Verstößen steht im Fehler.
  e = fall({ bauRot: ['pruef/a.mjs', 'check:r1'], prRot: ['pruef/a.mjs', 'check:r1', 'check:r1'] })
  assert.equal(e.status, 1, e.aus)
  assert.match(e.aus, /verletzt sind: check:r1\n/)
  assert.match(e.aus, /::warning::pruef\/a\.mjs/)

  // Fehlt die Zeile „VERSTÖSSE: n“ (Rest-Skript und Listenprüfung je), meldet der Schritt es laut und gilt als rot, auch wenn die Basis ebenso rot ist.
  for (const name of ['check:r2', 'pruef/b.mjs']) {
    e = fall({ bauRot: [name], prRot: [name], ohneZeile: [name] })
    assert.equal(e.status, 1, e.aus)
    assert.match(e.aus, new RegExp(`::error::${name.replace(/[.:/]/g, '\\$&')}: Zeile „VERSTÖSSE: <n>“ fehlt`))
    assert.doesNotMatch(e.aus, /::warning::/)
  }

  // A1 (PR 1386, R3): ein rotes Rest-Skript, das es nur im PR gibt, ist neu; die Basis fährt es nicht (sonst „Missing script“ = geerbt).
  e = fall({ restNeu: ['r4'], bauRot: ['check:r4'], prRot: ['check:r4'] })
  assert.equal(e.status, 1, e.aus)
  assert.deepEqual(e.basis, [], 'check:r4 gibt es auf der Basis nicht')
  assert.match(e.aus, /::error::.*weniger verletzt sind: check:r4\n/)
  assert.doesNotMatch(e.aus, /::warning::check:r4/)
} finally {
  unlinkSync(join(k, 'node_modules'))
  rmSync(k, { recursive: true, force: true })
  rmSync(spur, { force: true })
}
console.log('pr-bestand-vergleich.test: grün')
