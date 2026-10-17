/**
 * Test zu `tools/bau-eingaben.mjs`: Abdruck (welche Änderung ihn verschiebt), Auswertung der Spur und der Bau mit Spur in einem Wegwerf-Ordner
 * (echter Unterprozess mit `tools/bau-eingaben-spur.cjs`). Aufruf: node tools/bau-eingaben.test.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { abdruck, BAU_EINGABEN, bauMitSpur, frei, unerklaert } from './bau-eingaben.mjs'

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..')

// Freie Pfade: nur unter data/, docs/, daniel-zum-abarbeiten/ und Markdown in der Wurzel.
for (const p of ['data/bestand-historie.jsonl', 'docs/wissen/betrieb.md', 'daniel-zum-abarbeiten/stand.md', 'status.md', 'tools/umfang-grenzen.json']) assert.ok(frei(p), p)
for (const p of ['public/data/titles.json', 'web/src/main.tsx', 'tools/x.md', 'database/x.json', 'mydata/x.json', 'README.mdx', 'tools/umfang-grenzen.jsonc']) assert.ok(!frei(p), p)

const zeile = (pfad, kennung = '1'.repeat(40), art = '100644') => `${art} blob ${kennung}\t${pfad}`
const baum = (...eintraege) => `${eintraege.join('\0')}\0`
const NEU = '2'.repeat(40)
const BASIS = [zeile('data/a.json'), zeile('data/kennungen.json'), zeile('data/patchnotes/x.yaml'), zeile('status.md'), zeile('web/src/a.tsx'), zeile('data/z.json')]
const mitte = (i, neu) => baum(...BASIS.map((z, j) => (j === i ? neu : z)))
const A = abdruck(baum(...BASIS))
assert.match(A, /^[0-9a-f]{40}$/)
assert.equal(abdruck(mitte(0, zeile('data/a.json', NEU))), A, 'freie Datei mit neuem Inhalt: gleicher Abdruck')
assert.equal(abdruck(mitte(3, zeile('status.md', NEU))), A, 'Markdown der Wurzel mit neuem Inhalt: gleicher Abdruck')
assert.equal(abdruck(mitte(5, zeile('data/z.json', NEU))), A, 'letzte freie Datei mit neuem Inhalt: gleicher Abdruck')
assert.notEqual(abdruck(mitte(1, zeile('data/kennungen.json', NEU))), A, 'Bau-Eingabe geändert')
assert.notEqual(abdruck(mitte(2, zeile('data/patchnotes/x.yaml', NEU))), A, 'Datei im Eingabe-Ordner geändert')
assert.notEqual(abdruck(mitte(4, zeile('web/src/a.tsx', NEU))), A, 'Code geändert')
assert.notEqual(abdruck(mitte(0, zeile('data/a.json', undefined, '100755'))), A, 'Art einer freien Datei geändert')
assert.notEqual(abdruck(mitte(0, zeile('data/b.json'))), A, 'freie Datei umbenannt')
assert.notEqual(abdruck(baum(...BASIS, zeile('data/neu.json'))), A, 'freie Datei hinzugekommen')
assert.notEqual(abdruck(baum(...BASIS.slice(1))), A, 'freie Datei entfernt')
assert.deepEqual(BAU_EINGABEN, ['data/cartoon-umzug.json', 'data/kennungen.json', 'data/patchnotes/'])

// Spur: unerklärt sind freie Pfade außerhalb der Eingaben, deren Inhalt berührt wurde (Namenslisten zählen nicht).
const spur = [
  'readFileSync\tweb/src/a.tsx',
  'readdirSync\tdata',
  'readFileSync\tdata/patchnotes/x.yaml',
  'existsSync\tdata/b.json',
  'readFileSync\tdata/kennungen.json',
  'promises.readFile\tdocs/x.md',
  'readFileSync\tdata/patchnotes-alt.json',
  'opendirSync\tdaniel-zum-abarbeiten/listen',
  'statSync\tdata/b.json',
  'readFileSync\tdata/kennungen.json.alt',
  '',
]
assert.deepEqual(unerklaert(spur), ['data/b.json', 'data/kennungen.json.alt', 'data/patchnotes-alt.json', 'docs/x.md'])
const namen = ['readdirSync', 'readdir', 'opendirSync', 'opendir', 'promises.readdir', 'promises.opendir'].map((f) => `${f}\tdocs/wissen`)
assert.deepEqual(unerklaert([...namen, 'existsSync\tdata/patchnotes', 'readFileSync\tdata/cartoon-umzug.json', 'readFileSync\tpublic/data/t.json']), [])
// Ganze Ordner kopiert (natives cpSync, die Dateien darunter fehlen in der Spur): Wurzel und Vorfahren freier Pfade zählen als gelesen.
const kopien = ['cpSync\tweb', 'cpSync\tdata', 'statSync\t.', 'promises.cp\t.', 'readdirSync\tdata', 'cp\tdocs', 'cpSync\tdata/patchnotes']
const kopienHinten = ['cpSync\ttools', 'existsSync\ttools', 'cpSync\tdaniel-zum-abarbeiten', 'cpSync\tpublic', 'realpathSync\t.']
assert.deepEqual(unerklaert([...kopien, ...kopienHinten]), ['.', 'daniel-zum-abarbeiten', 'data', 'docs', 'tools'])

/**
 * Liest jeden Pfad aus argv; Vorsatz wählt den Weg: `p:` fs/promises, `u:` als URL, `b:` als Buffer, `r:` createReadStream, `o:` promises.open,
 * `n:` openSync, `f:` copyFileSync, `c:` cpSync des Ordners, `w:` Worker mit `env: {}`, `e`/`a`/`S`/`x`/`X`/`F`/`K`: Unterprozess per execFileSync,
 * spawn, spawnSync, execSync, exec, execFile, fork mit `env: {}`, `d:`/`v:` Unterprozess/Worker nach Löschen von NODE_OPTIONS und BAU_SPUR,
 * `k:` Unterprozess zählt den Vorlader in NODE_OPTIONS, `t:` Worker, der nach dem Lesen per `terminate()` endet (`h:` ist seine Seite),
 * sonst readFileSync.
 */
const LIES = [
  "import { closeSync, copyFileSync, cpSync, createReadStream, mkdtempSync, openSync, readFileSync, realpathSync, rmSync } from 'node:fs'",
  "import { open, readFile } from 'node:fs/promises'",
  "import { exec, execFile, execFileSync, execSync, fork, spawn, spawnSync } from 'node:child_process'",
  "import { tmpdir } from 'node:os'",
  "import { join, resolve } from 'node:path'",
  "import { pathToFileURL } from 'node:url'",
  "import { parentPort, Worker } from 'node:worker_threads'",
  "realpathSync.native('.')",
  'for (const a of process.argv.slice(2)) {',
  "  const [art, p] = a.includes(':') ? a.split(':') : ['s', a]",
  "  if (art === 'p') await readFile(p)",
  "  if (art === 'u') readFileSync(pathToFileURL(resolve(p)))",
  "  if (art === 'b') readFileSync(Buffer.from(p))",
  "  if (art === 's') readFileSync(p)",
  "  if (art === 'r') await new Promise((fertig) => createReadStream(p).on('close', fertig).resume())",
  "  if (art === 'o') await (await open(p)).close()",
  "  if (art === 'n') closeSync(openSync(p))",
  "  if (art === 'f' || art === 'c') {",
  "    const ziel = mkdtempSync(join(tmpdir(), 'bau-eingaben-kopie-'))",
  "    if (art === 'f') copyFileSync(p, join(ziel, 'k'))",
  "    if (art === 'c') cpSync(p, ziel, { recursive: true, force: true })",
  '    rmSync(ziel, { recursive: true, force: true })',
  '  }',
  "  if (art === 'e') execFileSync(process.execPath, ['lies.mjs', p], { env: {} })",
  "  if (art === 'd' || art === 'v') for (const n of ['NODE_OPTIONS', 'BAU_SPUR']) delete process.env[n]",
  "  if (art === 'd') execFileSync(process.execPath, ['lies.mjs', p])",
  "  if (art === 'v') await new Promise((fertig) => new Worker('./lies.mjs', { argv: [p] }).on('exit', fertig))",
  "  if (art === 'a') await new Promise((fertig) => spawn(process.execPath, ['lies.mjs', p], { env: {} }).on('exit', fertig))",
  "  if (art === 'S') spawnSync(process.execPath, ['lies.mjs', p], { env: {} })",
  "  if (art === 'x') execSync(`\"${process.execPath}\" lies.mjs ${p}`, { env: {} })",
  "  if (art === 'X') await new Promise((fertig) => exec(`\"${process.execPath}\" lies.mjs ${p}`, { env: {} }, fertig))",
  "  if (art === 'F') await new Promise((fertig) => execFile(process.execPath, ['lies.mjs', p], { env: {} }, fertig))",
  "  if (art === 'K') await new Promise((fertig) => fork('lies.mjs', [p], { env: {} }).on('exit', fertig))",
  "  if (art === 'k') execFileSync(process.execPath, ['-e', 'process.exitCode = process.env.NODE_OPTIONS.split(\"bau-eingaben-spur\").length - 2'])",
  "  if (art === 'w') await new Promise((fertig) => new Worker('./lies.mjs', { argv: [p], env: {} }).on('exit', fertig))",
  "  if (art === 't') await new Promise((fertig) => new Worker('./lies.mjs', { argv: [`h:${p}`] }).on('message', function () { this.terminate().then(fertig) }))",
  "  if (art === 'h') {",
  '    readFileSync(p)',
  '    setInterval(() => {}, 1000)',
  "    parentPort.postMessage('gelesen')",
  '  }',
  '}',
].join('\n')

/** Wegwerf-Wurzel mit Spur-Vorlader, `lies.mjs` (liest die Pfade aus argv) und `dist/version.json`. */
function wurzel() {
  const ort = mkdtempSync(join(tmpdir(), 'bau-eingaben-'))
  for (const d of ['tools', 'data', 'dist', 'web']) mkdirSync(join(ort, d))
  copyFileSync(join(WURZEL, 'tools', 'bau-eingaben-spur.cjs'), join(ort, 'tools', 'bau-eingaben-spur.cjs'))
  writeFileSync(join(ort, 'lies.mjs'), LIES)
  writeFileSync(join(ort, 'marke.cjs'), "require('node:fs').writeFileSync(require('node:path').join(__dirname, 'marke'), '')")
  for (const d of ['data/kennungen.json', 'data/frei.json', 'web.txt', 'web/a.txt']) writeFileSync(join(ort, d), '{}')
  writeFileSync(join(ort, 'dist', 'version.json'), JSON.stringify({ v: 'x', baum: 'b' }))
  return ort
}
/** Baut in einer Wegwerf-Wurzel; vorhandene NODE_OPTIONS (hier: ein Vorlader, der `marke` anlegt) müssen im Bau erhalten bleiben. */
const gitBaum = (args) => {
  assert.deepEqual(args, ['ls-tree', '-r', '-z', 'HEAD'])
  return baum(...BASIS)
}
function bau(befehl, git = gitBaum, mitMarke = true, starte) {
  const ort = wurzel()
  const meldungen = []
  const alt = process.env.NODE_OPTIONS
  if (mitMarke) process.env.NODE_OPTIONS = `${alt ?? ''} --require ${join(ort, 'marke.cjs').replace(/\\/g, '/')}`
  else delete process.env.NODE_OPTIONS
  const exit = bauMitSpur(befehl, { wurzel: ort, versionDatei: join(ort, 'dist', 'version.json'), git, log: (m) => meldungen.push(m), starte })
  process.env.NODE_OPTIONS = alt ?? ''
  const version = JSON.parse(readFileSync(join(ort, 'dist', 'version.json'), 'utf8'))
  const marke = existsSync(join(ort, 'marke'))
  rmSync(ort, { recursive: true, force: true })
  assert.equal(marke, mitMarke, `${befehl}: vorhandene NODE_OPTIONS bleiben`)
  return { exit, version, meldungen }
}
const ohneOptionen = bau('node lies.mjs data/frei.json', gitBaum, false)
assert.deepEqual([ohneOptionen.exit, ohneOptionen.version], [0, { v: 'x', baum: 'b' }], 'ohne NODE_OPTIONS: Bau läuft, Spur wirkt')
const gut = bau('node lies.mjs data/kennungen.json web.txt')
assert.deepEqual([gut.exit, gut.version], [0, { v: 'x', baum: 'b', abdruck: A }], 'nur Eingaben gelesen: Abdruck steht')
assert.match(gut.meldungen.join('\n'), new RegExp(`^Spur: [1-9]\\d* Zugriffe, 1 Prozesse und Threads, 0 unerklärt, Abdruck ${A}$`), 'Ergebniszeile fürs CI-Log')
const fremd = bau('node lies.mjs data/kennungen.json data/frei.json')
assert.deepEqual(fremd.version, { v: 'x', baum: 'b' }, 'freie Datei gelesen: kein Abdruck')
assert.equal(fremd.exit, 0, 'Bau bleibt grün, nur ohne Abdruck')
assert.match(fremd.meldungen.join('\n'), /^::warning::.*data\/frei\.json$/)
for (const weg of ['p', 'u', 'b']) assert.deepEqual(bau(`node lies.mjs ${weg}:data/frei.json`).version, { v: 'x', baum: 'b' }, `Lesen über ${weg}: kein Abdruck`)
const kind = bau('node -e "require(\'node:child_process\').execFileSync(process.execPath, [\'lies.mjs\', \'data/frei.json\'])"')
assert.deepEqual(kind.version, { v: 'x', baum: 'b' }, 'Unterprozess liest freie Datei: kein Abdruck')
// Feste Sonden (Prüfer R1): jeder Weg zu einer freien Datei wird gesehen, derselbe Weg zu einer Eingabe lässt den Abdruck stehen.
for (const weg of ['r', 'o', 'n', 'f', 'e', 'w', 'd', 'v', 'a', 'S', 'x', 'X', 'F', 'K']) {
  assert.deepEqual(bau(`node lies.mjs ${weg}:data/frei.json`).version, { v: 'x', baum: 'b' }, `${weg}: freie Datei gelesen, kein Abdruck`)
  assert.equal(bau(`node lies.mjs ${weg}:data/kennungen.json`).version.abdruck, A, `${weg}: nur Eingabe gelesen, Abdruck steht`)
}
for (const ordner of ['data', '.']) assert.deepEqual(bau(`node lies.mjs c:${ordner}`).version, { v: 'x', baum: 'b' }, `cpSync ${ordner}: kein Abdruck`)
assert.equal(bau('node lies.mjs c:web').version.abdruck, A, 'cpSync eines Ordners ohne freie Pfade: Abdruck steht')
// Ein per terminate() beendeter Worker schreibt kein `ende`: kein Abdruck, auch wenn er nur Eingaben las (Spur scheitert geschlossen).
const beendet = bau('node lies.mjs t:data/kennungen.json')
assert.deepEqual([beendet.exit, beendet.version], [0, { v: 'x', baum: 'b' }], 'Worker beendet: kein Abdruck')
assert.match(beendet.meldungen.join('\n'), /^::warning::Spur unvollständig \(1 von 2 Prozessen ohne Ende\)/)
assert.equal(bau('node lies.mjs k:x').exit, 0, 'Weiterreichen setzt den Vorlader nicht doppelt in NODE_OPTIONS')
// Spur aus der Kulisse: drei Dateien, die ohne `ende` in der Mitte; vollständig zählt die Ergebniszeile jede Zeile außer `ende`.
const spurDateien = (mitte) => (_befehl, optionen) => {
  writeFileSync(join(optionen.env.BAU_SPUR, '1-0.txt'), 'readFileSync\tdata/kennungen.json\nende\n')
  writeFileSync(join(optionen.env.BAU_SPUR, '1-1.txt'), `readFileSync\tweb.txt\nstatSync\tweb.txt\n${mitte}`)
  writeFileSync(join(optionen.env.BAU_SPUR, '2-0.txt'), 'readFileSync\tweb/a.txt\nende\n')
  return { status: 0, signal: null }
}
assert.match(bau('x', gitBaum, false, spurDateien('')).meldungen.join('\n'), /^::warning::Spur unvollständig \(1 von 3 Prozessen ohne Ende\)/)
const voll = bau('x', gitBaum, false, spurDateien('ende\n'))
assert.deepEqual(voll.meldungen, [`Spur: 4 Zugriffe, 3 Prozesse und Threads, 0 unerklärt, Abdruck ${A}`], 'Ergebniszeile zählt genau')
const leer = bau('exit 0', gitBaum, false)
assert.deepEqual([leer.exit, leer.version], [0, { v: 'x', baum: 'b' }], 'kein Node-Prozess in der Spur: kein Abdruck')
assert.match(leer.meldungen.join('\n'), /Spur unvollständig \(0 von 0/)
// Abbruch durch ein Signal: Status null. Die Kulisse lässt den Bau echt laufen und meldet danach das Signal (unter Windows gibt es keinen Status null).
const signal = (befehl, optionen) => ({ ...spawnSync(befehl, optionen), status: null, signal: 'SIGTERM' })
assert.deepEqual(bau('node lies.mjs data/kennungen.json', gitBaum, true, signal), { exit: 1, version: { v: 'x', baum: 'b' }, meldungen: [] }, 'Signal: rot, kein Abdruck')
assert.equal(bau('node -e "process.kill(process.pid, \'SIGKILL\')"').exit, 1, 'Befehl beendet sich per Signal: rot')
assert.deepEqual(bau('node lies.mjs data/kennungen.json && exit 3'), { exit: 1, version: { v: 'x', baum: 'b' }, meldungen: [] }, 'roter Bau')
const ohneGit = bau('node lies.mjs', () => {
  throw new Error('kein git')
})
assert.deepEqual([ohneGit.exit, ohneGit.version], [0, { v: 'x', baum: 'b' }], 'ohne Git kein Abdruck, Bau grün')
assert.match(ohneGit.meldungen.join('\n'), /Kein Git-Baum/)

// Die Konfiguration bündelt esbuild (Go, außerhalb der Spur): ihre statischen Importe dürfen keine freien Pfade erreichen.
const offen = [resolve(WURZEL, 'vite.config.ts')]
const besucht = new Set()
while (offen.length > 0) {
  const datei = offen.pop()
  if (besucht.has(datei)) continue
  besucht.add(datei)
  if (!existsSync(datei)) continue
  for (const [, ziel] of readFileSync(datei, 'utf8').matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) offen.push(resolve(dirname(datei), ziel))
}
const erreicht = [...besucht].map((d) => d.slice(WURZEL.length + 1).replace(/\\/g, '/'))
assert.ok(erreicht.includes('pipeline/lib/ausgabe-kennung.ts'), `Importe der Konfiguration verfolgt: ${erreicht.join(', ')}`)
assert.deepEqual(erreicht.filter(frei), [], 'Konfiguration importiert freie Pfade')
console.log('bau-eingaben.test: ok')
