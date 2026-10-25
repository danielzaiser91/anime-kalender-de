/** Lauffälle des Löschexperiments: Junction, Abbruchsignal, Endlauf im Wegwerf-Repo (Wurzel unter os.tmpdir()). */
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fahre, haengeAbbruchAn, loeseLink, pruefePfade, raeumeAuf, schlusszeile, verlinkeCache } from './loeschexperiment.mjs'

const tools = dirname(fileURLToPath(import.meta.url))
const basis = mkdtempSync(join(tmpdir(), 'loeschexp-ablauf-'))
const haupt = join(basis, 'haupt')
const wt = join(basis, 'wt')
const git = (cwd, ...a) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd, encoding: 'utf8', windowsHide: true })
const warte = (bedingung) =>
  new Promise((ok, nein) => {
    let n = 0
    const t = setInterval(() => {
      if (bedingung()) (clearInterval(t), ok())
      else if (++n > 200) (clearInterval(t), nein(new Error('Zeitüberschreitung')))
    }, 50)
  })

mkdirSync(join(haupt, 'data', 'cache'), { recursive: true })
writeFileSync(join(haupt, 'data', 'a.txt'), 'A')
writeFileSync(join(haupt, 'data', 'cache', 'x.txt'), 'X')
writeFileSync(join(haupt, '.gitignore'), 'data/cache\n*.log\n')
git(haupt, 'init', '-q')
git(haupt, 'add', '.')
git(haupt, 'commit', '-q', '-m', 'x')
git(haupt, 'worktree', 'add', '-q', wt, '-b', 'probe')
mkdirSync(join(wt, 'tools'), { recursive: true })
for (const f of ['loeschexperiment.mjs', 'loeschexperiment-vergleich.mjs']) copyFileSync(join(tools, f), join(wt, 'tools', f))
const zielCache = join(wt, 'data', 'cache')

// verlinkeCache / loeseLink: Junction legen, Inhalt bleibt beim Lösen; fehlender Pfad wirft nicht.
assert.equal(verlinkeCache(wt), true)
assert.equal(readFileSync(join(zielCache, 'x.txt'), 'utf8'), 'X')
loeseLink(zielCache)
assert.equal(existsSync(zielCache), false)
assert.equal(readFileSync(join(haupt, 'data', 'cache', 'x.txt'), 'utf8'), 'X') // Inhalt des Hauptordners unberührt
loeseLink(zielCache) // schon weg
// Echtes Verzeichnis am Ziel: kein Link, nichts überschrieben, loeseLink lässt es stehen.
mkdirSync(zielCache, { recursive: true })
writeFileSync(join(zielCache, 'eigen.txt'), 'E')
assert.equal(verlinkeCache(wt), false)
loeseLink(zielCache)
assert.equal(readFileSync(join(zielCache, 'eigen.txt'), 'utf8'), 'E')
rmSync(zielCache, { recursive: true })
// raeumeAuf (Weg von Ende und Abbruch): gelöschte Pfade kommen zurück, die Junction verschwindet, der Hauptordner bleibt.
assert.equal(verlinkeCache(wt), true)
rmSync(join(wt, 'data', 'a.txt'))
raeumeAuf(wt, ['data/a.txt'], true)
assert.equal(readFileSync(join(wt, 'data', 'a.txt'), 'utf8'), 'A')
assert.equal(existsSync(zielCache), false)
assert.equal(readFileSync(join(haupt, 'data', 'cache', 'x.txt'), 'utf8'), 'X')
// Quelle fehlt: false.
assert.equal(verlinkeCache(join(basis, 'ohne-quelle-wt')), false)

// Pfad auf anderem Laufwerk (nur Windows: dort ist `relative` absolut statt `..`).
if (process.platform === 'win32') assert.match(pruefePfade(wt, ['D:/fremd', 'E:\\x']), /außerhalb/)
else console.log('loeschexperiment-ablauf.test: Laufwerkfall übersprungen (nicht win32)')

// skip-worktree und assume-unchanged werden abgewiesen.
assert.equal(pruefePfade(wt, ['data/a.txt']), '')
git(wt, 'update-index', '--skip-worktree', 'data/a.txt')
assert.match(pruefePfade(wt, ['data']), /skip-worktree/)
git(wt, 'update-index', '--no-skip-worktree', 'data/a.txt')
git(wt, 'update-index', '--assume-unchanged', 'data/a.txt')
assert.match(pruefePfade(wt, ['data/a.txt']), /assume-unchanged/)
git(wt, 'update-index', '--no-assume-unchanged', 'data/a.txt')
assert.equal(pruefePfade(wt, ['data/a.txt']), '')

// Skriptname: keine Shell-Sonderzeichen.
assert.throws(() => fahre(wt, 'x; echo'), /Ungültiger Skriptname/)
assert.throws(() => fahre(wt, ''), /Ungültiger Skriptname/)

// Schlusszeile: beide Zweige.
assert.equal(schlusszeile(2, 1, ''), 'loeschexperiment: 2 Prüfungen, 1 abweichend, Pfade wiederhergestellt.')
assert.equal(schlusszeile(2, 1, ' M x'), 'loeschexperiment: 2 Prüfungen, 1 abweichend, Pfade NICHT wiederhergestellt:  M x.')

// Abbruchsignal: Aufräumen läuft vor dem Beenden mit 130, je Signal.
for (const sig of ['SIGINT', 'SIGTERM']) {
  const quelle = new EventEmitter()
  const ablauf = []
  haengeAbbruchAn(quelle, () => ablauf.push('raeume'), (code) => ablauf.push(`ende ${code}`))
  quelle.emit(sig)
  assert.deepEqual(ablauf, ['raeume', 'ende 130'])
}

// Endlauf als Prozess mit `--cache` auf `data`: Junction weg, Pfade zurück, kein ENOENT, Haupt-Cache unberührt.
writeFileSync(join(wt, 'tools', 'schwer.mjs'), "import { existsSync, writeFileSync } from 'node:fs'\nif (!existsSync('data/a.txt')) writeFileSync('zweiter-lauf', '1')\nif (existsSync('data/a.txt')) console.log('basis')\n")
const lauf = spawnSync(process.execPath, ['tools/loeschexperiment.mjs', 'data', '--cache', '--pruefung', 'p'], { cwd: wt, encoding: 'utf8', windowsHide: true })
assert.equal(lauf.status, 0, lauf.stderr)
assert.match(lauf.stdout, /Pfade wiederhergestellt\./)
assert.equal(existsSync(zielCache), false)
assert.equal(readFileSync(join(wt, 'data', 'a.txt'), 'utf8'), 'A')
assert.equal(existsSync(join(wt, 'zweiter-lauf')), true) // der zweite Lauf sah die gelöschten Pfade
assert.equal(readFileSync(join(haupt, 'data', 'cache', 'x.txt'), 'utf8'), 'X')

// Bleibt nach der Wiederherstellung etwas Ignoriertes zurück (hier: Log des zweiten Laufs), sagt die Schlusszeile es.
writeFileSync(join(wt, 'tools', 'schwer.mjs'), "import { existsSync, mkdirSync, writeFileSync } from 'node:fs'\nif (!existsSync('data/a.txt')) {\n  mkdirSync('data', { recursive: true })\n  writeFileSync('data/roh.log', '1')\n}\n")
const rest = spawnSync(process.execPath, ['tools/loeschexperiment.mjs', 'data', '--pruefung', 'p'], { cwd: wt, encoding: 'utf8', windowsHide: true })
assert.equal(rest.status, 0, rest.stderr)
assert.match(rest.stdout, /NICHT wiederhergestellt: !! data\/roh\.log/)
rmSync(join(wt, 'data', 'roh.log'))

// Echtes SIGTERM (nur POSIX; unter Windows beendet process.kill hart, ohne Handler): auf den Endzustand warten.
if (process.platform === 'win32') {
  console.log('loeschexperiment-ablauf.test: SIGTERM-Prozessfall übersprungen (win32: process.kill beendet ohne Handler)')
} else {
  rmSync(join(wt, 'zweiter-lauf'), { force: true })
  writeFileSync(join(wt, 'tools', 'schwer.mjs'), "import { existsSync, writeFileSync } from 'node:fs'\nif (!existsSync('data/a.txt')) {\n  writeFileSync('haengt', '1')\n  setTimeout(() => {}, 20000)\n}\n")
  const kind = spawn(process.execPath, ['tools/loeschexperiment.mjs', 'data', '--cache', '--pruefung', 'p'], { cwd: wt, stdio: 'ignore', windowsHide: true })
  const ende = new Promise((ok) => kind.once('exit', (code) => ok(code)))
  await warte(() => existsSync(join(wt, 'haengt')))
  kind.kill('SIGTERM')
  assert.equal(await ende, 130)
  assert.equal(existsSync(zielCache), false)
  assert.equal(readFileSync(join(wt, 'data', 'a.txt'), 'utf8'), 'A')
}

rmSync(basis, { recursive: true, force: true })
console.log('loeschexperiment-ablauf.test: alle Fälle grün (Junction, Laufwerk, skip-worktree, Skriptname, Schlusszeile, Abbruch, Endlauf)')
