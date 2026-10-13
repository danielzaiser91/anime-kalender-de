/**
 * Test für `tools/dist-frisch.mjs`: fehlendes, veraltetes und frisches `dist/`.
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { distProblem } from './dist-frisch.mjs'

const wurzel = mkdtempSync(path.join(tmpdir(), 'dist-frisch-'))
try {
  mkdirSync(path.join(wurzel, 'web', 'src'), { recursive: true })
  const quelle = path.join(wurzel, 'web', 'src', 'App.tsx')
  writeFileSync(quelle, 'x')

  assert.match(distProblem(wurzel), /dist\/ fehlt.*npm run build/, 'fehlendes dist/')

  mkdirSync(path.join(wurzel, 'dist'))
  const index = path.join(wurzel, 'dist', 'index.html')
  writeFileSync(index, 'x')
  const alt = new Date('2020-01-01')
  utimesSync(index, alt, alt)
  assert.match(distProblem(wurzel), /älter als web\/src.*npm run build/, 'veraltetes dist/')

  // Eine Sekunde Vorsprung: mtimeMs der Quelle hat Nachkommastellen, `new Date()` nur ganze Millisekunden.
  const neu = new Date(Date.now() + 1000)
  utimesSync(index, neu, neu)
  assert.equal(distProblem(wurzel), null, 'frisches dist/')
  console.log('dist-frisch: ok')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
