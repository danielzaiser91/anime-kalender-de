/**
 * Test zu `tools/bau-eingaben.mjs`: Abdruck (welche Änderung ihn verschiebt, samt Patch-Note-Log), Auswertung der Spur (Pfade, Programmstarts, `ende`),
 * Bau-Befehl in package.json und der Bau mit Spur in einem Wegwerf-Ordner (echte Unterprozesse, auch tsx). Aufruf: node tools/bau-eingaben.test.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { abdruck, abdruckAusGit, BAU_EINGABEN, bauMitSpur, befehlErlaubt, frei, PATCHNOTES_LOG, unerklaert } from './bau-eingaben.mjs'

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..')

// Freie Pfade: nur unter data/, docs/, daniel-zum-abarbeiten/ und Markdown in der Wurzel.
for (const p of ['data/bestand-historie.jsonl', 'docs/wissen/betrieb.md', 'daniel-zum-abarbeiten/stand.md', 'status.md', 'tools/umfang-grenzen.json']) assert.ok(frei(p), p)
for (const p of ['public/data/titles.json', 'web/src/main.tsx', 'tools/x.md', 'database/x.json', 'mydata/x.json', 'README.mdx', 'tools/umfang-grenzen.jsonc']) assert.ok(!frei(p), p)

const zeile = (pfad, kennung = '1'.repeat(40), art = '100644') => `${art} blob ${kennung}\t${pfad}`
const baum = (...eintraege) => `${eintraege.join('\0')}\0`
const NEU = '2'.repeat(40)
const BASIS = [zeile('data/a.json'), zeile('data/kennungen.json'), zeile('data/patchnotes/x.yaml'), zeile('status.md'), zeile('web/src/a.tsx'), zeile('data/z.json')]
const mitte = (i, neu) => baum(...BASIS.map((z, j) => (j === i ? neu : z)))
/** Ausgabe von PATCHNOTES_LOG (Commit-Zeit vor der hinzugefügten Datei); sie geht in den Abdruck ein. */
const LOGTEXT = '@1760000000\n\ndata/patchnotes/x.yaml\n'
const abdruckMit = (b, log = LOGTEXT) => abdruck(b, log)
const A = abdruckMit(baum(...BASIS))
assert.match(A, /^[0-9a-f]{40}$/)
assert.notEqual(abdruckMit(baum(...BASIS), LOGTEXT.replace('@1760000000', '@1760090000')), A, 'Commit-Zeit einer Patch Note geändert')
assert.notEqual(abdruckMit(baum(...BASIS), ''), A, 'Patch Note nicht mehr hinzugefügt')
// Der Deploy kürzt jede git-Ausgabe (`.trim()`), der Bau nicht: das Zeilenende der Log-Ausgabe darf den Abdruck nicht verschieben (Prüfer R5).
assert.equal(abdruckMit(baum(...BASIS), LOGTEXT.trim()), A, 'Log-Ausgabe ohne Zeilenende: gleicher Abdruck')
assert.equal(abdruckMit(baum(...BASIS), `${LOGTEXT}\n`), A, 'Log-Ausgabe mit zwei Zeilenenden: gleicher Abdruck')
const gitMit = (kuerzen) => (args) => {
  const antwort = args[0] === 'rev-parse' ? 'false\n' : args[0] === 'ls-tree' ? baum(...BASIS) : LOGTEXT
  return kuerzen ? antwort.trim() : antwort
}
assert.equal(abdruckAusGit(gitMit(false)), A, 'Bau (git roh): Abdruck')
assert.equal(abdruckAusGit(gitMit(true)), A, 'Deploy (git gekürzt): derselbe Abdruck')
assert.equal(abdruckMit(mitte(0, zeile('data/a.json', NEU))), A, 'freie Datei mit neuem Inhalt: gleicher Abdruck')
assert.equal(abdruckMit(mitte(3, zeile('status.md', NEU))), A, 'Markdown der Wurzel mit neuem Inhalt: gleicher Abdruck')
assert.equal(abdruckMit(mitte(5, zeile('data/z.json', NEU))), A, 'letzte freie Datei mit neuem Inhalt: gleicher Abdruck')
assert.notEqual(abdruckMit(mitte(1, zeile('data/kennungen.json', NEU))), A, 'Bau-Eingabe geändert')
assert.notEqual(abdruckMit(mitte(2, zeile('data/patchnotes/x.yaml', NEU))), A, 'Datei im Eingabe-Ordner geändert')
assert.notEqual(abdruckMit(mitte(4, zeile('web/src/a.tsx', NEU))), A, 'Code geändert')
assert.notEqual(abdruckMit(mitte(0, zeile('data/a.json', undefined, '100755'))), A, 'Art einer freien Datei geändert')
assert.notEqual(abdruckMit(mitte(0, zeile('data/b.json'))), A, 'freie Datei umbenannt')
assert.notEqual(abdruckMit(baum(...BASIS, zeile('data/neu.json'))), A, 'freie Datei hinzugekommen')
assert.notEqual(abdruckMit(baum(...BASIS.slice(1))), A, 'freie Datei entfernt')
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

// Programmstarts (Prüfer R2): erlaubt sind Node, der esbuild-Dienst, `net use` und die git-Aufrufe des Baus im Wortlaut; alles andere
// und jedes process.binding ist unerklärt — jeder Fremdstart einzeln in der Mitte der erlaubten.
const start = (s) => `start\t${JSON.stringify(s)}`
const ESB = '/r/node_modules/@esbuild/linux-x64/bin/esbuild'
// Node gilt nur mit Kennung, die ein Kind in seine Spur-Datei geschrieben hat (Prüfer R3, Auflage 2).
const KENNUNGEN = new Set(['7-0-1', '7-0-2', '7-0-3'])
const erlaubt = [
  start({ datei: 'C:\\Programme\\nodejs\\node.exe', argv: ['x.mjs'], cwd: '.', kennung: '7-0-2' }),
  start({ datei: ESB, argv: ['--service=0.25.12', '--ping'], cwd: '.' }),
  start({ datei: 'git', argv: PATCHNOTES_LOG, cwd: '.' }),
  start({ datei: 'C:\\r\\node_modules\\vite\\node_modules\\@esbuild\\win32-x64\\esbuild.exe', argv: ['--service=0.28.1'], cwd: 'web' }),
  start({ datei: 'git', argv: ['rev-parse', 'HEAD^{tree}'], cwd: '.' }),
  start({ shell: 'net use' }),
  start({ datei: 'git', argv: ['rev-parse', '--is-shallow-repository'], cwd: '.' }),
  start({ datei: 'C:\\Git\\cmd\\git.exe', argv: ['fetch', '--unshallow', '--filter=blob:none', '--quiet', 'origin'], cwd: '.' }),
  start({ datei: '/usr/bin/node', argv: [], cwd: 'web', kennung: '7-0-3' }),
  'dlopen\t//?/C:/r/node_modules/@rollup/rollup-win32-x64-msvc/rollup.win32-x64-msvc.node',
  'dlopen\t/r/node_modules/@tailwindcss/oxide-linux-x64-gnu/tailwindcss-oxide.linux-x64-gnu.node',
  'dlopen\t/r/node_modules/lightningcss-linux-x64-gnu/lightningcss.linux-x64-gnu.node',
  'scanner\tweb',
]
assert.deepEqual(unerklaert(erlaubt, KENNUNGEN), [], 'erlaubte Starts')
const fremdeStarts = [
  start({ datei: 'cat', argv: ['data/frei.json'], cwd: '.' }),
  start({ datei: 'git', argv: ['log', 'data/frei.json'], cwd: '.' }),
  start({ datei: 'git', argv: PATCHNOTES_LOG, cwd: 'web' }),
  start({ datei: 'git', argv: ['rev-parse', 'HEAD^{tree}'] }),
  start({ datei: 'git', argv: [...PATCHNOTES_LOG, 'x'], cwd: '.' }),
  start({ datei: 'git', argv: PATCHNOTES_LOG.slice(0, -1), cwd: '.' }),
  start({ datei: ESB, argv: ['--service=0.25.12', 'data/frei.json'], cwd: '.' }),
  start({ datei: ESB, argv: ['data/frei.json'], cwd: '.' }),
  start({ datei: ESB, argv: ['--service=0.25.12', '--ping', '--ping'], cwd: '.' }),
  start({ datei: '/r/esbuild', argv: ['--service=0.25.12'], cwd: '.' }),
  start({ datei: ESB, argv: ['--service=../data/frei.json'], cwd: '.' }),
  start({ datei: '/r/tools/esbuild/bin/esbuild', argv: ['--service=0.25.12'], cwd: '.' }),
  start({ datei: 'cat', argv: ['rev-parse', 'HEAD^{tree}'], cwd: '.' }),
  start({ shell: 'node -e 0 && cat data/frei.json' }),
  start({ shell: 'net use x' }),
  start({ roh: 'cat' }),
  start({ datei: 'nodex', argv: [], cwd: '.' }),
  start({ datei: 'node' }),
  'binding\tfs',
  start({ datei: '/usr/bin/node', argv: [], cwd: '.' }),
  start({ datei: '/usr/bin/node', argv: [], cwd: '.', kennung: '7-0-4' }),
  // Ein Hüllprogramm, das selbst liest und Node startet: Das Kind schreibt die Kennung, der Name bleibt fremd.
  start({ datei: '/usr/bin/nodex', argv: [], cwd: '.', kennung: '7-0-1' }),
  'dlopen\t/r/node_modules/sharp/build/sharp.node',
  'dlopen\t/r/node_modules/@swc/core-linux-x64-gnu/swc.linux-x64-gnu.node',
  'dlopen\t/r/node_modules/@napi-rs/canvas.linux-x64-gnu.node',
  'dlopen\t/r/xnode_modules/lightningcss-linux-x64-gnu/lightningcss.linux-x64-gnu.node',
  'dlopen\t/r/node_modules/@rollup/rollup-linux-x64-gnu/rollup.node',
  'dlopen\t/r/node_modules/lightningcss-linux-x64-gnu/lightningcss.linux-x64-gnu.node.x',
  'nativ\tbundle',
]
for (const f of fremdeStarts) {
  const erwartet = [`${f.split('\t')[0]} ${f.split('\t')[1]}`]
  assert.deepEqual(unerklaert([...erlaubt.slice(0, 4), f, ...erlaubt.slice(4)], KENNUNGEN), erwartet, `Fremdstart in der Mitte: ${f}`)
}
assert.equal(unerklaert(fremdeStarts, KENNUNGEN).length, fremdeStarts.length, 'jeder Fremdstart gezählt')
// Der Tailwind-Scanner liest ganze Ordner: Wurzel, Vorfahren freier Pfade und freie Ordner sind unerklärt.
assert.deepEqual(unerklaert(['scanner\tweb', 'scanner\tdocs', 'scanner\tpublic', 'scanner\t.', 'scanFiles\tweb/a.tsx', 'scanFiles\tdata/x.json']), ['.', 'data/x.json', 'docs'])

// Bau-Befehl (Wächter auf package.json): feste Prüfungen vorweg, dann die Spur bis zum Ende (Prüfer R3, Auflage 1: kein Schritt dahinter);
// in der Spur nur `vite build` und `tsx pipeline/<name>.ts` mit `&&`.
const paket = JSON.parse(readFileSync(join(WURZEL, 'package.json'), 'utf8')).scripts.build
const VORWEG = 'npm run check:umfang && npm run check:hooks && npm run check:folgen && tsc -b --noEmit'
const innerer = /node tools\/bau-eingaben\.mjs "([^"]*)"/.exec(paket)?.[1]
assert.ok(befehlErlaubt(innerer), `Bau-Befehl in package.json: ${innerer}`)
assert.equal(paket, `${VORWEG} && node tools/bau-eingaben.mjs "${innerer}"`, 'Bau-Befehl: Prüfungen vorweg, Spur bis zum Ende')
assert.ok(befehlErlaubt('vite build && tsx pipeline/a-b.ts && tsx pipeline/c.ts'))
assert.ok(befehlErlaubt('vite build && node tools/daten-adressen-pruefen.mjs && node tools/start-budget.mjs && tsx tools/dateibudget.ts'))
for (const b of ['vite build && cat data/x', 'vite build; cat data/x', 'tsx pipeline/../x.ts', 'tsx pipeline/a.ts && node -e 1', 'node tools/daten-adressen-pruefen.mjs --x', 'node tools/anderes.mjs', 'vite build && node tools/daten-adressen-pruefen.mjs.x', 'vite build|cat', 'vite build --x', 'tsx pipeline/a.ts > data/x', '', undefined]) {
  assert.ok(!befehlErlaubt(b), `Befehl nicht erlaubt: ${b}`)
}

/**
 * Liest jeden Pfad aus argv; Vorsatz wählt den Weg: `p:` fs/promises, `u:` als URL, `b:` als Buffer, `r:` createReadStream, `o:` promises.open,
 * `n:` openSync, `f:` copyFileSync, `c:` cpSync des Ordners, `w:` Worker mit `env: {}`, `e`/`a`/`S`/`x`/`X`/`F`/`K`: Unterprozess per execFileSync,
 * spawn, spawnSync, execSync, exec, execFile, fork mit `env: {}`, `d:`/`v:` Unterprozess/Worker nach Löschen von NODE_OPTIONS und BAU_SPUR,
 * `k:` Unterprozess zählt den Vorlader in NODE_OPTIONS, `t:` Worker, der nach dem Lesen per `terminate()` endet (`h:` ist seine Seite),
 * `g:`/`G:`/`H:` startet `cat`, `git log <p>`, `git rev-parse HEAD^{tree}`, `P:` process.binding, `J:` über eine Junction unter `dist/`,
 * `Q:` über `\\?\` (Windows) bzw. `/proc/self/cwd` (Linux), `U:` prüft die Rückgaben von promisify, `E:` promisify(fs.exists), `Z:`
 * promisify(execFile) startet `cat`, `C:` startet Node über `ChildProcess` direkt, sonst readFileSync.
 */
/** Ein Programm namens node, das nicht Node ist (Prüfer R3): Kopie von `cat` bzw. `findstr` in `falsch/` der Wegwerf-Wurzel. */
const FALSCHER_NODE = process.platform === 'win32' ? 'node.exe' : 'node'
const FREMDPROGRAMM = process.platform === 'win32' ? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'findstr.exe') : '/bin/cat'
/** Ein natives Modul unter fremdem Pfad: Kopie des oxide-Moduls dieser Plattform. */
const OXIDE_NODE = (() => {
  const ordner = join(WURZEL, 'node_modules', '@tailwindcss')
  const paket = readdirSync(ordner).find((d) => d.startsWith('oxide-') && readdirSync(join(ordner, d)).some((f) => f.endsWith('.node')))
  return join(ordner, paket, readdirSync(join(ordner, paket)).find((f) => f.endsWith('.node')))
})()
const SONDEN_R2 = [
  "  const still = { stdio: 'ignore' }",
  "  if (art === 'g') try { execFileSync('cat', [p], still) } catch {}",
  "  if (art === 'G') try { execFileSync('git', ['log', p], still) } catch {}",
  "  if (art === 'H') try { execFileSync('git', ['rev-parse', 'HEAD^{tree}'], still) } catch {}",
  "  if (art === 'P') process.binding('fs')",
  "  if (art === 'J') {",
  "    symlinkSync(resolve('data'), 'dist/d', 'junction')",
  "    readFileSync(join('dist/d', p.replace('data/', '')))",
  '  }',
  "  if (art === 'Q') readFileSync(process.platform === 'win32' ? toNamespacedPath(resolve(p)) : `/proc/self/cwd/${p}`)",
  "  if (art === 'U') {",
  "    const { stdout } = await promisify(execFile)(process.execPath, ['-e', 'process.stdout.write(\"ja\")'])",
  "    const { stdout: ausShell } = await promisify(exec)(`\"${process.execPath}\" -e 0`)",
  '    const fd = openSync(p)',
  '    const { bytesRead } = await promisify(fs.read)(fd, Buffer.alloc(2), 0, 2, 0)',
  "    if (stdout !== 'ja' || ausShell !== '' || bytesRead !== 2 || (await promisify(fs.exists)(p)) !== true) process.exit(9)",
  '  }',
  "  if (art === 'E') await promisify(fs.exists)(p)",
  "  if (art === 'Z') try { await promisify(execFile)('cat', [p]) } catch {}",
  "  if (art === 'C') await new Promise((fertig) => {",
  '    const k = new ChildProcess()',
  "    k.on('exit', fertig).on('error', fertig)",
  "    k.spawn({ file: process.execPath, args: [process.execPath, 'lies.mjs', p], stdio: 'ignore' })",
  '  })',
  // R3: Shell-Starts, die wie Node heißen; git außerhalb der Wurzel; Lesen über einen Link unter data/ und über den echten Wurzelpfad.
  "  if (art === 'Y') execSync('node', still)",
  "  if (art === 'y') await new Promise((fertig) => exec('node', fertig).stdin.end())",
  "  if (art === 'V') spawnSync('node', { shell: true, stdio: 'ignore' })",
  "  if (art === 'W') try { execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: 'web', stdio: 'ignore' }) } catch {}",
  "  if (art === 'L') {",
  "    symlinkSync(resolve('web'), 'data/l', 'junction')",
  "    readFileSync('data/l/a.txt')",
  '  }',
  "  if (art === 'N') {",
  "    symlinkSync(resolve('data'), 'dist/d', 'junction')",
  "    existsSync('dist/d/fehlt.json')",
  '  }',
  "  if (art === 'R') readFileSync(join(realpathSync.native('.'), p))",
  // R4: Kind mit eigener NODE_OPTIONS ohne Vorlader; Fremdprogramm namens node, direkt und als `execPath` von fork; Tailwind-Scanner.
  "  if (art === 'O') execFileSync(process.execPath, ['lies.mjs', p], { env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' } })",
  "  if (art === 'M') for (const datei of [process.execPath, FALSCH, process.execPath]) try { execFileSync(datei, ['x', p], still) } catch {}",
  "  if (art === 'B') await new Promise((fertig) => {",
  "    fork('lies.mjs', [p], { execPath: FALSCH, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }).on('exit', fertig).on('error', fertig)",
  '  })',
  "  if (art === 'T') {",
  "    const ausgenommen = { base: resolve('data'), pattern: '**/*', negated: true }",
  "    new (scanner())({ sources: [ausgenommen, { base: resolve(p), pattern: '**/*', negated: false }, ausgenommen] }).scan()",
  '  }',
  "  if (art === 'D') new (scanner())({ sources: [] }).scanFiles(['web/a.txt', p, 'web.txt'].map((f) => ({ file: resolve(f), extension: 'json' })))",
  // R5: Tailwind-Form der Quelle (base = Ordner der CSS-Datei, pattern = roher @source-Text); Lesen in Node selbst (loadEnvFile, node:sqlite).
  "  if (art === 'Tf') new (scanner())({ sources: [{ base: resolve('web'), pattern: `../${p}`, negated: false }] }).scan()",
  "  if (art === 'Le') process.loadEnvFile(p)",
  "  if (art === 'Sq') try { new (await import('node:sqlite')).DatabaseSync(p) } catch {}",
  "  if (art === 'Sr') try { new (createRequire(import.meta.url)('node:sqlite').DatabaseSync)(p) } catch {}",
  "  if (art === 'Sg') try { new (process.getBuiltinModule('node:sqlite').DatabaseSync)(p) } catch {}",
  // R5: zwei Starter - ein echtes Node-Kind (Kennung) und ein Fremdprogramm namens node im Kind bzw. im Haupt-Thread nach einem Worker.
  "  if (art === 'Ip') execFileSync(process.execPath, ['lies.mjs', `If:${p}`])",
  "  if (art === 'If') try { execFileSync(FALSCH, ['x', p], still) } catch {}",
  "  if (art === 'It') {",
  "    await new Promise((fertig) => new Worker('./lies.mjs', { argv: ['Iw:web.txt'] }).on('exit', fertig))",
  "    try { execFileSync(FALSCH, ['x', p], still) } catch {}",
  '  }',
  "  if (art === 'Iw') execFileSync(process.execPath, ['lies.mjs', 'web.txt'])",
  // Native Module: lightningcss bündelt nativ (jeder Aufruf unerklärt), ein natives Modul außerhalb der gemessenen.
  "  if (art === 'lb') try { lightningcss().bundle({ filename: resolve(p) }) } catch {}",
  "  if (art === 'la') try { await lightningcss().bundleAsync({ filename: resolve(p) }) } catch {}",
  "  if (art === 'nf') createRequire(import.meta.url)('./falsch/fremd.node')",
]
const LIES = [
  "import fs, { closeSync, existsSync, symlinkSync, copyFileSync, cpSync, createReadStream, mkdtempSync, openSync, readFileSync, realpathSync, rmSync } from 'node:fs'",
  "import { open, readFile } from 'node:fs/promises'",
  "import { ChildProcess, exec, execFile, execFileSync, execSync, fork, spawn, spawnSync } from 'node:child_process'",
  "import { promisify } from 'node:util'",
  "import { tmpdir } from 'node:os'",
  "import { join, resolve, toNamespacedPath } from 'node:path'",
  "import { pathToFileURL } from 'node:url'",
  "import { parentPort, Worker } from 'node:worker_threads'",
  "import { createRequire } from 'node:module'",
  `const scanner = () => createRequire(${JSON.stringify(join(WURZEL, 'package.json'))})('@tailwindcss/oxide').Scanner`,
  `const lightningcss = () => createRequire(${JSON.stringify(join(WURZEL, 'package.json'))})('lightningcss')`,
  `const FALSCH = resolve('falsch', ${JSON.stringify(FALSCHER_NODE)})`,
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
  ...SONDEN_R2,
  '}',
].join('\n')

/** Wegwerf-Wurzel mit Spur-Vorlader, `lies.mjs`/`lies.ts` (lesen die Pfade aus argv) und `dist/version.json`. */
function wurzel() {
  const ort = mkdtempSync(join(tmpdir(), 'bau-eingaben-'))
  for (const d of ['tools', 'data', 'dist', 'web', 'falsch']) mkdirSync(join(ort, d))
  copyFileSync(FREMDPROGRAMM, join(ort, 'falsch', FALSCHER_NODE))
  copyFileSync(OXIDE_NODE, join(ort, 'falsch', 'fremd.node'))
  copyFileSync(join(WURZEL, 'tools', 'bau-eingaben-spur.cjs'), join(ort, 'tools', 'bau-eingaben-spur.cjs'))
  writeFileSync(join(ort, 'lies.mjs'), LIES)
  writeFileSync(join(ort, 'lies.ts'), "import { readFileSync } from 'node:fs'\nconst p: string = process.argv[2]\nreadFileSync(p)\n")
  writeFileSync(join(ort, 'marke.cjs'), "require('node:fs').writeFileSync(require('node:path').join(__dirname, 'marke'), '')")
  for (const d of ['data/kennungen.json', 'data/frei.json', 'web.txt', 'web/a.txt']) writeFileSync(join(ort, d), '{}')
  writeFileSync(join(ort, 'dist', 'version.json'), JSON.stringify({ v: 'x', baum: 'b' }))
  return ort
}
/** Git-Kulisse: beantwortet nur die Aufrufe von abdruckAusGit (voller Klon), alles andere wirft. */
const gitBaum = (args) => {
  const antworten = new Map([
    ['rev-parse --is-shallow-repository', 'false\n'],
    ['ls-tree -r -z HEAD', baum(...BASIS)],
    [PATCHNOTES_LOG.join(' '), LOGTEXT],
  ])
  const antwort = antworten.get(args.join(' '))
  if (antwort === undefined) throw new Error(`unerwarteter git-Aufruf: ${args.join(' ')}`)
  return antwort
}
/** `STANDARD`: bauMitSpur prüft den Befehl mit seiner Voreinstellung (befehlErlaubt). */
const STANDARD = Symbol('Standard')
/** Baut in einer Wegwerf-Wurzel; vorhandene NODE_OPTIONS (hier: ein Vorlader, der `marke` anlegt) müssen im Bau erhalten bleiben. */
function bau(befehl, git = gitBaum, mitMarke = true, starte, befehlPruefen = () => true) {
  const ort = wurzel()
  const meldungen = []
  const alt = process.env.NODE_OPTIONS
  if (mitMarke) process.env.NODE_OPTIONS = `${alt ?? ''} --require ${join(ort, 'marke.cjs').replace(/\\/g, '/')}`
  else delete process.env.NODE_OPTIONS
  const versionDatei = join(ort, 'dist', 'version.json')
  const pruefe = befehlPruefen === STANDARD ? undefined : befehlPruefen
  const exit = bauMitSpur(befehl, { wurzel: ort, versionDatei, git, log: (m) => meldungen.push(m), starte, befehlPruefen: pruefe })
  process.env.NODE_OPTIONS = alt ?? ''
  const version = JSON.parse(readFileSync(versionDatei, 'utf8'))
  const marke = existsSync(join(ort, 'marke'))
  rmSync(ort, { recursive: true, force: true })
  assert.equal(marke, mitMarke, `${befehl}: vorhandene NODE_OPTIONS bleiben`)
  return { exit, version, meldungen }
}
const OHNE = { v: 'x', baum: 'b' }
const ohneOptionen = bau('node lies.mjs data/frei.json', gitBaum, false)
assert.deepEqual([ohneOptionen.exit, ohneOptionen.version], [0, OHNE], 'ohne NODE_OPTIONS: Bau läuft, Spur wirkt')
const gut = bau('node lies.mjs data/kennungen.json web.txt')
assert.deepEqual([gut.exit, gut.version], [0, { ...OHNE, abdruck: A }], 'nur Eingaben gelesen: Abdruck steht')
assert.match(gut.meldungen.join('\n'), new RegExp(`^Spur: [1-9]\\d* Zugriffe, 1 Prozesse und Threads, 0 unerklärt, Abdruck ${A}$`), 'Ergebniszeile fürs CI-Log')
// Befehl außerhalb von befehlErlaubt (Standard-Prüfung): kein Abdruck, auch wenn die Spur sauber ist.
const fremderBefehl = bau('node lies.mjs data/kennungen.json', gitBaum, true, undefined, STANDARD)
assert.deepEqual([fremderBefehl.exit, fremderBefehl.version], [0, OHNE], 'fremder Befehl: kein Abdruck')
assert.match(fremderBefehl.meldungen.join('\n'), /^::warning::Bau-Befehl außerhalb von befehlErlaubt/)
const fremd = bau('node lies.mjs data/kennungen.json data/frei.json')
assert.deepEqual(fremd.version, OHNE, 'freie Datei gelesen: kein Abdruck')
assert.equal(fremd.exit, 0, 'Bau bleibt grün, nur ohne Abdruck')
assert.match(fremd.meldungen.join('\n'), /^::warning::.*data\/frei\.json$/)
for (const weg of ['p', 'u', 'b']) assert.deepEqual(bau(`node lies.mjs ${weg}:data/frei.json`).version, OHNE, `Lesen über ${weg}: kein Abdruck`)
const kind = bau('node -e "require(\'node:child_process\').execFileSync(process.execPath, [\'lies.mjs\', \'data/frei.json\'])"')
assert.deepEqual(kind.version, OHNE, 'Unterprozess liest freie Datei: kein Abdruck')
// Feste Sonden (Prüfer R1): jeder Weg zu einer freien Datei wird gesehen, derselbe Weg zu einer Eingabe lässt den Abdruck stehen.
// x/X starten über die Shell: das ist selbst unerklärt, also auch mit Eingabe kein Abdruck.
for (const weg of ['r', 'o', 'n', 'f', 'e', 'w', 'd', 'v', 'a', 'S', 'x', 'X', 'F', 'K', 't']) {
  assert.deepEqual(bau(`node lies.mjs ${weg}:data/frei.json`).version, OHNE, `${weg}: freie Datei gelesen, kein Abdruck`)
  const erwartet = weg === 'x' || weg === 'X' ? undefined : A
  assert.equal(bau(`node lies.mjs ${weg}:data/kennungen.json`).version.abdruck, erwartet, `${weg}: nur Eingabe gelesen`)
}
for (const ordner of ['data', '.']) assert.deepEqual(bau(`node lies.mjs c:${ordner}`).version, OHNE, `cpSync ${ordner}: kein Abdruck`)
assert.equal(bau('node lies.mjs c:web').version.abdruck, A, 'cpSync eines Ordners ohne freie Pfade: Abdruck steht')
// Sonden R2: Fremdstarts, process.binding, Aliase und promisify.custom.
for (const weg of ['g', 'G', 'P', 'Z', 'C', 'J', 'Q', 'E']) assert.deepEqual(bau(`node lies.mjs ${weg}:data/frei.json`).version, OHNE, `${weg}: kein Abdruck`)
for (const weg of ['H', 'E', 'J', 'Q']) assert.equal(bau(`node lies.mjs ${weg}:data/kennungen.json`).version.abdruck, A, `${weg}: Eingabe, Abdruck steht`)
assert.equal(bau('node lies.mjs U:data/kennungen.json').exit, 0, 'promisify liefert über die Hülle dieselben Werte')
assert.equal(bau('node lies.mjs k:x').exit, 0, 'Weiterreichen setzt den Vorlader nicht doppelt in NODE_OPTIONS')
// Sonden R3: C (ChildProcess direkt), Shell-Starts namens node, git in web/, Link unter data/, fehlende Datei hinter einer Junction.
for (const weg of ['C', 'Y', 'y', 'V', 'W', 'L', 'N']) {
  const ergebnis = bau(`node lies.mjs ${weg}:data/kennungen.json`)
  assert.deepEqual([ergebnis.exit, ergebnis.version], [0, OHNE], `${weg}: unerklärt, kein Abdruck`)
}
// Sonden R4 (Prüfer R3, Auflagen 2 bis 4): eigene NODE_OPTIONS ohne Vorlader, Tailwind-Scanner (Ordner und scanFiles); je freier Weg ohne,
// derselbe Weg zu einer Eingabe mit Abdruck.
for (const [weg, frei, eingabe] of [['O', 'data/frei.json', 'data/kennungen.json'], ['T', 'data', 'web'], ['Tf', 'data', 'web'], ['D', 'data/frei.json', 'data/kennungen.json']]) {
  assert.deepEqual(bau(`node lies.mjs ${weg}:${frei}`).version, OHNE, `${weg}: freier Pfad, kein Abdruck`)
  assert.equal(bau(`node lies.mjs ${weg}:${eingabe}`).version.abdruck, A, `${weg}: nur Eingabe, Abdruck steht`)
}
const NATIVE_WEGE = { lb: /nativ bundle(,|$)/, la: /nativ bundleAsync/, nf: /dlopen [^,]*falsch\/fremd\.node/, Le: /nativ loadEnvFile/, Sq: /nativ sqlite/, Sr: /nativ sqlite/, Sg: /nativ sqlite/ }
for (const [weg, muster] of Object.entries(NATIVE_WEGE)) {
  const ergebnis = bau(`node lies.mjs ${weg}:web/a.txt`)
  assert.deepEqual([ergebnis.exit, ergebnis.version], [0, OHNE], `${weg}: natives Lesen, kein Abdruck`)
  assert.match(ergebnis.meldungen.join('\n'), muster, weg)
}
// Fremdprogramm namens node, direkt und als `execPath` von fork: schreibt keine Kennung, der Start steht mit seinem Pfad in der Warnung.
for (const weg of ['M', 'B', 'Ip', 'It']) {
  const ergebnis = bau(`node lies.mjs ${weg}:data/kennungen.json`)
  assert.deepEqual([ergebnis.exit, ergebnis.version], [0, OHNE], `${weg}: Node ohne Spur-Datei, kein Abdruck`)
  assert.match(ergebnis.meldungen.join('\n'), /"datei":"[^"]*falsch(\\\\|\/)node(\.exe)?"/, `${weg}: Pfad des Fremdprogramms in der Warnung`)
}
// Wurzel über einen Link gebaut: Lesen über den echten Pfad der Wurzel zählt wie Lesen ab Wurzel.
function bauUeberLink(argument) {
  const ort = wurzel()
  const link = join(mkdtempSync(join(tmpdir(), 'bau-eingaben-link-')), 'w')
  symlinkSync(ort, link, 'junction')
  const versionDatei = join(link, 'dist', 'version.json')
  bauMitSpur(`node lies.mjs ${argument}`, { wurzel: link, versionDatei, git: gitBaum, log: () => {}, befehlPruefen: () => true })
  const version = JSON.parse(readFileSync(versionDatei, 'utf8'))
  rmSync(dirname(link), { recursive: true, force: true })
  rmSync(ort, { recursive: true, force: true })
  return version
}
assert.deepEqual(bauUeberLink('R:data/frei.json'), OHNE, 'Link-Wurzel, freie Datei über den echten Pfad: kein Abdruck')
assert.equal(bauUeberLink('R:data/kennungen.json').abdruck, A, 'Link-Wurzel, Eingabe über den echten Pfad: Abdruck steht')
// Eine Spur-Datei beginnt mit `beginn`: Bei wiederverwendeter PID steht so nie das `ende` des Vorgängers am Schluss.
const spurOrdner = mkdtempSync(join(tmpdir(), 'bau-eingaben-beginn-'))
const vorlader = `--require ${join(WURZEL, 'tools', 'bau-eingaben-spur.cjs').replace(/\\/g, '/')}`
spawnSync(process.execPath, ['-e', '0'], { env: { ...process.env, BAU_SPUR: spurOrdner, NODE_OPTIONS: vorlader } })
const spurZeilen = readdirSync(spurOrdner).map((d) => readFileSync(join(spurOrdner, d), 'utf8').split('\n').filter(Boolean))
rmSync(spurOrdner, { recursive: true, force: true })
assert.deepEqual(spurZeilen.map((z) => [z[0], z.at(-1)]), [['beginn', 'ende']], 'Spur-Datei: beginn … ende')
// Echtes tsx (Ladethreads ohne `ende`, Prüfer R2): liest es nur eine Eingabe, steht der Abdruck.
const TSX = `node "${join(WURZEL, 'node_modules', 'tsx', 'dist', 'cli.mjs')}" lies.ts`
const tsx = bau(`${TSX} data/kennungen.json`)
assert.deepEqual([tsx.exit, tsx.version.abdruck], [0, A], `tsx liest nur Eingabe: ${tsx.meldungen.join(' | ')}`)
assert.deepEqual(bau(`${TSX} data/frei.json`).version, OHNE, 'tsx liest freie Datei: kein Abdruck')
// Spur aus der Kulisse: Haupt-Thread `1-0` in der Mitte; die Ergebniszeile zählt jede Zeile außer `beginn`/`ende`.
const spurDateien = (haupt, thread = '1-1.txt') => (_befehl, optionen) => {
  writeFileSync(join(optionen.env.BAU_SPUR, '0-0.txt'), 'beginn\nreadFileSync\tdata/kennungen.json\nende\n')
  writeFileSync(join(optionen.env.BAU_SPUR, '1-0.txt'), haupt)
  writeFileSync(join(optionen.env.BAU_SPUR, thread), 'beginn\nreadFileSync\tweb.txt\nstatSync\tweb.txt\n')
  writeFileSync(join(optionen.env.BAU_SPUR, '2-0.txt'), 'beginn\nreadFileSync\tweb/a.txt\nende\n')
  return { status: 0, signal: null }
}
const unvollstaendig = (h, t) => bau('x', gitBaum, false, spurDateien(h, t)).meldungen.join('\n')
assert.match(unvollstaendig('beginn\nreadFileSync\tweb.txt\n'), /^::warning::Spur unvollständig \(1 Prozesse ohne Ende, 4 Spur-Dateien\)/)
assert.match(unvollstaendig('beginn\nende\nbeginn\nreadFileSync\tweb.txt\n'), /\(1 Prozesse ohne Ende/, 'PID wiederverwendet: ende nur in der Mitte')
assert.match(unvollstaendig('beginn\nende\n', '3-1.txt'), /\(1 Prozesse ohne Ende/, 'Thread ohne Haupt-Thread-Datei')
assert.match(unvollstaendig('beginn\nende\n', 'x.txt'), /\(1 Prozesse ohne Ende/, 'Datei ohne PID-Muster')
const voll = bau('x', gitBaum, false, spurDateien('beginn\nreadFileSync\tweb.txt\nende\n'))
assert.deepEqual(voll.meldungen, [`Spur: 5 Zugriffe, 4 Prozesse und Threads, 0 unerklärt, Abdruck ${A}`], 'Thread ohne ende: vollständig')
// Kennung eines Node-Starts zählt nur aus dem Haupt-Thread eines anderen Prozesses (nicht aus dem Starter, nicht aus einem Thread).
const NODE_START = `start\t${JSON.stringify({ datei: 'node', argv: [], cwd: '.', kennung: '1-0-1' })}`
const kennungIn = (ziel) => (_befehl, optionen) => {
  for (const d of ['0-0.txt', '1-0.txt', '1-1.txt', '2-0.txt', '2-1.txt']) {
    const start = d === '1-0.txt' ? `${NODE_START}\n` : ''
    const kennung = d === ziel ? 'kennung\t1-0-1\n' : ''
    writeFileSync(join(optionen.env.BAU_SPUR, d), `beginn\n${kennung}${start}${d.endsWith('-0.txt') ? 'ende\n' : ''}`)
  }
  return { status: 0, signal: null }
}
const mitKennung = bau('x', gitBaum, false, kennungIn('2-0.txt'))
assert.equal(mitKennung.version.abdruck, A, 'Kennung im Haupt-Thread des Kinds: Abdruck steht')
assert.deepEqual(mitKennung.meldungen, [`Spur: 1 Zugriffe, 5 Prozesse und Threads, 0 unerklärt, Abdruck ${A}`], 'Kennung zählt nicht als Zugriff')
for (const ziel of ['1-0.txt', '1-1.txt', '2-1.txt', 'keine']) {
  assert.match(bau('x', gitBaum, false, kennungIn(ziel)).meldungen.join('\n'), /^::warning::.*"kennung":"1-0-1"/, `Kennung nur in ${ziel}: unerklärt`)
}
const leer = bau('exit 0', gitBaum, false)
assert.deepEqual([leer.exit, leer.version], [0, OHNE], 'kein Node-Prozess in der Spur: kein Abdruck')
assert.match(leer.meldungen.join('\n'), /Spur unvollständig \(0 Prozesse ohne Ende, 0 Spur-Dateien\)/)
// Abbruch durch ein Signal: Status null. Die Kulisse lässt den Bau echt laufen und meldet danach das Signal (unter Windows gibt es keinen Status null).
const signal = (befehl, optionen) => ({ ...spawnSync(befehl, optionen), status: null, signal: 'SIGTERM' })
assert.deepEqual(bau('node lies.mjs data/kennungen.json', gitBaum, true, signal), { exit: 1, version: OHNE, meldungen: [] }, 'Signal: rot, kein Abdruck')
assert.equal(bau('node -e "process.kill(process.pid, \'SIGKILL\')"').exit, 1, 'Befehl beendet sich per Signal: rot')
assert.deepEqual(bau('node lies.mjs data/kennungen.json && exit 3'), { exit: 1, version: OHNE, meldungen: [] }, 'roter Bau')
const ohneGit = bau('node lies.mjs', () => {
  throw new Error('kein git')
})
assert.deepEqual([ohneGit.exit, ohneGit.version], [0, OHNE], 'ohne Git kein Abdruck, Bau grün')
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

// Tailwind durchsucht nativ (oxide, Prüfer R3 Auflage 4): kein `@source` und kein `source(…)` einer CSS-Datei zeigt aus web/ heraus.
const cssDateien = (ordner) => readdirSync(ordner, { withFileTypes: true }).flatMap((e) => {
  const voll = join(ordner, e.name)
  if (e.isDirectory()) return e.name === 'node_modules' ? [] : cssDateien(voll)
  return e.name.endsWith('.css') ? [voll] : []
})
const quellen = cssDateien(join(WURZEL, 'web')).flatMap((datei) => {
  const text = readFileSync(datei, 'utf8')
  const ziele = [...text.matchAll(/@source\s+(?!not\s)['"]([^'"]+)['"]/g), ...text.matchAll(/\bsource\(\s*['"]([^'"]+)['"]\s*\)/g)]
  return ziele.map(([, ziel]) => relative(WURZEL, resolve(dirname(datei), ziel)).replace(/\\/g, '/'))
})
assert.ok(quellen.includes('web/buehne/mockups/**/*.tsx'), `@source gefunden: ${quellen.join(', ')}`)
assert.deepEqual(quellen.filter((q) => !q.startsWith('web/')), [], 'Tailwind-Quelle außerhalb von web/')
assert.equal(readFileSync(join(WURZEL, 'vite.config.ts'), 'utf8').match(/^ {2}root: '([^']*)',$/m)?.[1], 'web', 'Wurzel von Vite (Basis des Scanners): web')

// Exit-Code des Aufrufs aus package.json als eigener Prozess: scheitert der Befehl, Exit 1; läuft er (hier ohne Abdruck), Exit 0.
const cli = (befehl) => spawnSync(process.execPath, [join(WURZEL, 'tools', 'bau-eingaben.mjs'), befehl], { cwd: WURZEL, encoding: 'utf8' })
assert.equal(cli('exit 3').status, 1, 'Bau rot: Exit 1')
const gruen = cli('exit 0')
assert.deepEqual([gruen.status, /^::warning::Bau-Befehl außerhalb/.test(gruen.stdout)], [0, true], 'Bau grün, fremder Befehl: Exit 0 mit Warnung')
console.log('bau-eingaben.test: ok')
