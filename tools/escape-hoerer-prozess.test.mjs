// Prozess-Test von pipeline/check-escape-hoerer.ts: Exit-Code gegen einen Wegwerf-Baum (web/src), sauber, roher Hörer, ohne Helfer.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const WURZEL = resolve(import.meta.dirname, '..')
const TSX = join(WURZEL, 'node_modules', 'tsx', 'dist', 'cli.mjs')
const ROH = "document.addEventListener('keydown', (e) => e.key === 'Escape' && zu())\n"
const SAUBER = 'useEscape(true, () => zu())\n'

function baue(dateien) {
  const dir = mkdtempSync(join(tmpdir(), 'escape-hoerer-'))
  for (const [d, inhalt] of Object.entries(dateien)) {
    mkdirSync(join(dir, d, '..'), { recursive: true })
    writeFileSync(join(dir, d), inhalt)
  }
  return dir
}

function fahre(dir) {
  return spawnSync(process.execPath, [TSX, join(WURZEL, 'pipeline', 'check-escape-hoerer.ts'), '--wurzel', dir], { encoding: 'utf8', windowsHide: true, timeout: 120000 })
}

const helfer = 'web/src/lib/escape.ts'
const baeume = {
  sauber: baue({ [helfer]: ROH, 'web/src/components/a.tsx': SAUBER }),
  roh: baue({ [helfer]: ROH, 'web/src/components/a.tsx': ROH }),
  ohneHelfer: baue({ 'web/src/components/a.tsx': SAUBER }),
}
try {
  const a = fahre(baeume.sauber)
  assert.equal(a.status, 0, a.stderr)
  assert.match(a.stdout, /^check-escape-hoerer: ok \(2 Dateien in web\/src, 0 Meldungen\)/m)
  const b = fahre(baeume.roh)
  assert.equal(b.status, 1, b.stdout)
  assert.match(b.stderr, /web\/src\/components\/a\.tsx:1 roher Escape-Hörer/)
  assert.match(b.stdout, /FEHLER \(2 Dateien in web\/src, 1 Meldungen\)/)
  const c = fahre(baeume.ohneHelfer)
  assert.equal(c.status, 1, c.stdout)
  assert.match(c.stderr, /web\/src\/lib\/escape\.ts fehlt/)
  console.log('escape-hoerer-prozess: ok (sauber Exit 0, roher Hörer Exit 1, Helfer fehlt Exit 1)')
} finally {
  for (const d of Object.values(baeume)) rmSync(d, { recursive: true, force: true })
}
