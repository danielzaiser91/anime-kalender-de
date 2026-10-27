// Prozess-Test von pipeline/check-leerzeichen-gleich.ts: Exit-Code gegen ein Wegwerf-Repo (git ls-files), mit und ohne geplanten Treffer.
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const WURZEL = resolve(import.meta.dirname, '..')
const TSX = join(WURZEL, 'node_modules', 'tsx', 'dist', 'cli.mjs')
const DATEIEN = [
  'pipeline/a.ts', 'shared/a.ts', 'web/src/a.tsx', 'tools/a.mjs', 'extension/a.cjs', 'worker/a.js',
]

function baueRepo(inhalt) {
  const dir = mkdtempSync(join(tmpdir(), 'lz-gleich-'))
  for (const d of DATEIEN) {
    mkdirSync(join(dir, d, '..'), { recursive: true })
    writeFileSync(join(dir, d), inhalt(d))
  }
  execFileSync('git', ['init', '-q'], { cwd: dir, windowsHide: true })
  execFileSync('git', ['add', '-A'], { cwd: dir, windowsHide: true })
  return dir
}

function fahre(dir) {
  return spawnSync(process.execPath, [TSX, join(WURZEL, 'pipeline', 'check-leerzeichen-gleich.ts'), '--wurzel', dir], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
  })
}

const sauber = baueRepo(() => 'export const x = 1\n')
const geplant = baueRepo((d) => (d === 'tools/a.mjs' ? 'export const x =1\n' : 'export const x = 1\n'))
try {
  const a = fahre(sauber)
  assert.equal(a.status, 0, a.stderr)
  assert.match(a.stdout, /^check-leerzeichen-gleich: ok \(6 Dateien, 0 Treffer/m)
  const b = fahre(geplant)
  assert.equal(b.status, 1)
  assert.match(b.stderr, /tools\/a\.mjs:1 Leerzeichen nach = fehlt/)
  assert.match(b.stdout, /FEHLER \(6 Dateien, 1 Treffer/)
  console.log('leerzeichen-gleich-prozess: ok (sauber Exit 0, geplanter Treffer Exit 1)')
} finally {
  rmSync(sauber, { recursive: true, force: true })
  rmSync(geplant, { recursive: true, force: true })
}
