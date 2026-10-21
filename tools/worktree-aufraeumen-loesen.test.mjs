/**
 * Test für `raeumeLosen` und `bewerteLosenPfad` in `tools/claude-global/hooks/worktree-aufraeumen.js`:
 * Nebenläufige Datei beim Lösen, Haupt-Bestand verschwindet mitten im Lauf, unlesbarer und verschwundener Ordner.
 * Wegwerf-Ordner unter os.tmpdir(), nie unter dem Repo.
 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const H = createRequire(import.meta.url)(join(import.meta.dirname, 'claude-global', 'hooks', 'worktree-aufraeumen.js'))

const wurzel = mkdtempSync(join(tmpdir(), 'wt-loesen-'))
const haupt = join(wurzel, 'haupt')
const ziel = join(wurzel, 'ziel')
mkdirSync(join(haupt, 'node_modules'), { recursive: true })
mkdirSync(join(haupt, 'data', 'cache'), { recursive: true })
mkdirSync(ziel)
writeFileSync(join(ziel, 'x.txt'), 'x')
const link = (p) => { mkdirSync(dirname(p), { recursive: true }); symlinkSync(ziel, p, 'junction') }
const istLink = (p) => lstatSync(p).isSymbolicLink()

try {
  // A1: Entsteht während des Lösens eine Datei im Ordner, bleibt sie stehen (rmdir, nie rekursives Löschen).
  const a = join(wurzel, '_wt-a')
  link(join(a, 'sub', 'nm'))
  assert.throws(() => H.raeumeLosen(a, haupt, (p) => { unlinkSync(p); writeFileSync(join(dirname(p), 'neu.txt'), 'n') }), /ENOTEMPTY|EEXIST|EPERM/)
  assert.equal(existsSync(join(a, 'sub', 'neu.txt')), true, 'Datei, die beim Lösen entstand, bleibt')
  assert.equal(existsSync(join(ziel, 'x.txt')), true, 'Ziel der Links bleibt voll')

  // A2: Zwei Links; verschwindet der Haupt-Bestand nach dem ersten, wird der zweite nicht mehr gelöst.
  const b = join(wurzel, '_wt-b')
  link(join(b, 'a-link'))
  link(join(b, 'z-link'))
  let n = 0
  assert.throws(() => H.raeumeLosen(b, haupt, (p) => {
    unlinkSync(p)
    if (n++ === 0) renameSync(join(haupt, 'node_modules'), join(haupt, 'nm-weg'))
  }), /Haupt-Bestand fehlt/)
  assert.equal(n, 1, 'nach dem Verschwinden wird nichts mehr gelöst')
  assert.equal(istLink(join(b, 'z-link')), true, 'zweiter Link bleibt')
  renameSync(join(haupt, 'nm-weg'), join(haupt, 'node_modules'))

  // H1: Ein verschwundener Ordner bricht die Bewertung nicht ab.
  assert.deepEqual(H.bewerteLosenPfad(join(wurzel, '_wt-gibt-es-nicht'), haupt, 0), { aktion: 'behalten', grund: 'unlesbar' })

  // A3: Unlesbarer Ordner bleibt (chmod wirkt nur unter Linux und nicht für root; unter Windows gibt es keine Entsprechung, dort läuft die Linux-Kette).
  const lesbar = process.platform !== 'win32' && process.getuid?.() !== 0
  if (lesbar) {
    const c = join(wurzel, '_wt-c')
    link(join(c, 'node_modules'))
    chmodSync(c, 0)
    try { assert.deepEqual(H.bewerteLosenPfad(c, haupt, 0), { aktion: 'behalten', grund: 'unlesbar' }) } finally { chmodSync(c, 0o755) }
  } else console.log('A3 übersprungen: chmod 000 greift nur unter Linux ohne root')
  console.log('worktree-aufraeumen-loesen: ok')
} finally {
  for (const p of [join(wurzel, '_wt-a', 'sub', 'nm'), join(wurzel, '_wt-b', 'a-link'), join(wurzel, '_wt-b', 'z-link'), join(wurzel, '_wt-c', 'node_modules')]) {
    try { if (istLink(p)) unlinkSync(p) } catch { /* schon weg */ }
  }
  rmSync(wurzel, { recursive: true, force: true })
}
