// Test für falls-vorhanden.js: Aufruf: node .claude/hooks/falls-vorhanden-test.mjs
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const hook = join(import.meta.dirname, 'falls-vorhanden.js')
const lauf = (args, input = '') => spawnSync(process.execPath, [hook, ...args], { input, encoding: 'utf8', timeout: 30000, windowsHide: true })
const ordner = mkdtempSync(join(tmpdir(), 'falls-vorhanden-'))
try {
  const fehlt = lauf([join(ordner, 'gibt-es-nicht.mjs'), '--x'])
  assert.equal(fehlt.status, 0, 'fehlendes Skript: Exit 0')
  assert.equal(fehlt.stdout + fehlt.stderr, '', 'fehlendes Skript: still')

  const ohneArgument = lauf([])
  assert.equal(ohneArgument.status, 0, 'ohne Argument: Exit 0')

  const skript = join(ordner, 'echo.mjs')
  writeFileSync(skript, "let s='';process.stdin.on('data',(c)=>{s+=c});process.stdin.on('end',()=>{console.log(JSON.stringify([process.argv.slice(2),s]));process.exit(Number(process.argv[2]===\"fehler\")*3)})")
  const da = lauf([skript, 'a', 'b'], 'eingabe')
  assert.equal(da.status, 0)
  assert.equal(da.stdout.trim(), JSON.stringify([['a', 'b'], 'eingabe']), 'Argumente und stdin werden durchgereicht')

  const rot = lauf([skript, 'fehler'])
  assert.equal(rot.status, 3, 'Exit-Code des Skripts wird durchgereicht')
  console.log('falls-vorhanden-test: ok (fehlt, ohne Argument, durchgereicht, Exit-Code)')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
