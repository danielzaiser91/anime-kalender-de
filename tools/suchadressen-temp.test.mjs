/** Zusicherung zu `pipeline/lib/suchadressen-temp.ts`: Ordner entsteht, verschwindet mit dem Prozess, Reste über einer Stunde werden entfernt. */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const alt = join(tmpdir(), `suchadressen-test-alt-${process.pid}`)
const neu = join(tmpdir(), `suchadressen-test-neu-${process.pid}`)
for (const o of [alt, neu]) mkdirSync(o, { recursive: true })
const vorZweiStunden = new Date(Date.now() - 2 * 60 * 60 * 1000)
utimesSync(alt, vorZweiStunden, vorZweiStunden)

const kind = spawnSync(
  process.execPath,
  ['-e', "import('./pipeline/lib/suchadressen-temp.ts').then((m) => { m.suchadressenInTemp(); console.log(process.env.SUCHADRESSEN_ORDNER + '|' + require('node:fs').existsSync(process.env.SUCHADRESSEN_ORDNER)) })"],
  { cwd: join(import.meta.dirname, '..'), encoding: 'utf8' },
)
const [ordner, daWahrend] = kind.stdout.trim().split('|')
try {
  assert.equal(kind.status, 0, kind.stderr)
  assert.equal(daWahrend, 'true', 'der Ordner existiert, solange der Prozess läuft')
  assert.equal(existsSync(ordner), false, 'der Ordner verschwindet mit dem Prozess')
  assert.equal(existsSync(alt), false, 'ein Rest über einer Stunde wird entfernt')
  assert.equal(existsSync(neu), true, 'ein frischer Ordner (anderer Lauf) bleibt')
  console.log('suchadressen-temp.test: ok')
} finally {
  rmSync(alt, { recursive: true, force: true })
  rmSync(neu, { recursive: true, force: true })
}
