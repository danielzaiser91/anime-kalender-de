import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { dateiInhalt, geschaetzterBedarf, mischeZeilen, pruefeKontingent, tagNachLetzterZeile } from './tageskennzahlen-anhaengen.mjs'
import { tagBerlin, tagPlus } from './tageskennzahlen-rechnen.mjs'

const z = (tag, merges = 0) => JSON.stringify({ tag, merges })

test('mischen: Altes bleibt, gleicher Tag wird ersetzt, Neues wird einsortiert', () => {
  const alt = `${z('2026-11-12', 1)}\n${z('2026-11-14', 2)}\n`
  const r = mischeZeilen(alt, [z('2026-11-13', 5), z('2026-11-14', 9), z('2026-11-15', 7)])
  assert.deepEqual(r.map((x) => JSON.parse(x)), [{ tag: '2026-11-12', merges: 1 }, { tag: '2026-11-13', merges: 5 }, { tag: '2026-11-14', merges: 9 }, { tag: '2026-11-15', merges: 7 }])
})

test('Tag nach der letzten Zeile, leere Datei nimmt die Vorgabe', () => {
  assert.equal(tagNachLetzterZeile(`${z('2026-11-30')}\n${z('2026-11-14')}\n`, 'x'), '2026-12-01')
  assert.equal(tagNachLetzterZeile('', '2026-10-01'), '2026-10-01')
})

test('Kontingent: zu klein bricht ab, ausreichend nicht', () => {
  assert.throws(() => pruefeKontingent(1000, 46), /Kontingent zu klein: 1000/)
  assert.doesNotThrow(() => pruefeKontingent(5000, 1))
})

test('Kontingent: Randwert uebrig == Bedarf reicht, einer weniger nicht', () => {
  assert.doesNotThrow(() => pruefeKontingent(geschaetzterBedarf(3), 3))
  assert.throws(() => pruefeKontingent(geschaetzterBedarf(3) - 1, 3), /Kontingent zu klein/)
})

test('Dateiinhalt: anhaengen mischt, sonst ersetzt der Lauf die Datei', () => {
  const alt = `${z('2026-11-12', 1)}\n`
  assert.equal(dateiInhalt(alt, [z('2026-11-13', 2)], true), `${z('2026-11-12', 1)}\n${z('2026-11-13', 2)}\n`)
  assert.equal(dateiInhalt(alt, [z('2026-11-13', 2)], false), `${z('2026-11-13', 2)}\n`)
})

const SKRIPT = fileURLToPath(new URL('./tageskennzahlen.mjs', import.meta.url))
function lauf(argumente, { gh, tage = '' } = {}) {
  const ordner = mkdtempSync(join(tmpdir(), 'kennzahlen-'))
  mkdirSync(join(ordner, 'tools/kennzahlen'), { recursive: true })
  writeFileSync(join(ordner, 'tools/kennzahlen/tage.jsonl'), tage)
  mkdirSync(join(ordner, 'bin'))
  writeFileSync(join(ordner, 'bin/gh'), `#!/bin/sh\n${gh ?? 'exit 1'}\n`, { mode: 0o755 })
  const r = spawnSync(process.execPath, [SKRIPT, ...argumente], { cwd: ordner, encoding: 'utf8', timeout: 30_000, env: { ...process.env, PATH: `${join(ordner, 'bin')}:${process.env.PATH}` } })
  return { ...r, datei: readFileSync(join(ordner, 'tools/kennzahlen/tage.jsonl'), 'utf8') }
}

test('main: zu kleines Kontingent bricht mit Exit 1 ab, vor jedem weiteren Abruf', () => {
  const r = lauf(['--von=2026-11-01', '--bis=2026-11-10', '--ohne-lehren'], { gh: 'echo 10' })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /FEHLER \(Kontingent\): GitHub-Kontingent zu klein: 10 /)
})

test('main: --anhaengen mit Datei bis gestern ist „nichts zu tun“ (Exit 0, Datei unverändert, kein gh-Aufruf)', () => {
  const gestern = tagPlus(tagBerlin(Date.now()), -1)
  const tage = `${z(gestern, 4)}\n`
  const r = lauf(['--anhaengen', '--ohne-lehren'], { tage })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /Nichts zu tun/)
  assert.equal(r.datei, tage)
})
