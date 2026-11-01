/**
 * Gegenprobe zu tools/quelltext-lesungen.mjs: eine Lesung mehr als die Grenze ist rot (Exit 1, Zeile genannt), genau die Grenze und
 * weniger sind grün, eine unlesbare Grenzdatei oder fehlende Quelldatei ist rot, und der echte Stand liegt in der Grenze.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { lesungen } from './quelltext-lesungen.mjs'

const werkzeug = join(import.meta.dirname, 'quelltext-lesungen.mjs')
const ordner = mkdtempSync(join(tmpdir(), 'quelltext-lesungen-'))

function lauf(text, grenzenText) {
  const datei = join(ordner, 'check-logic.ts')
  const grenzen = join(ordner, 'grenze.json')
  if (text !== null) writeFileSync(datei, text)
  writeFileSync(grenzen, grenzenText)
  return spawnSync(process.execPath, [werkzeug, '--datei', datei, '--grenzen', grenzen], { encoding: 'utf8', timeout: 30_000 })
}

const eine = "const a = readFileSync('pipeline/a.ts', 'utf8')\n"
const zweite = 'x(readFileSync("web/b.mjs", "utf8"))\n'
const fremd = "const d = readFileSync('data/x.json', 'utf8')\nconst e = readFileSync(pfad, 'utf8')\n"
const grenze = (n) => JSON.stringify({ grenze: n })

try {
  assert.deepEqual(lesungen(eine + fremd + zweite), [1, 4], 'nur Quelltext-Endungen zählen, mit Zeilennummer')

  const gleich = lauf(eine + zweite + fremd, grenze(2))
  assert.equal(gleich.status, 0, 'genau die Grenze ist grün')
  assert.match(gleich.stdout, /Quelltext-Lesungen in check-logic\.ts: 2 \(Grenze 2\)/)
  assert.doesNotMatch(gleich.stdout, /gesunken/)

  const mehr = lauf(eine + zweite + zweite, grenze(2))
  assert.equal(mehr.status, 1, 'eine Lesung mehr ist rot')
  assert.match(mehr.stderr, /3 \(Grenze 2\)[\s\S]*Zeilen: 1, 2, 3/)

  const weniger = lauf(eine, grenze(2))
  assert.equal(weniger.status, 0, 'weniger ist grün')
  assert.match(weniger.stdout, /1 \(Grenze 2\) — gesunken/, 'Hinweis, die Grenze zu senken')

  assert.equal(lauf('', grenze(0)).status, 0, 'null Lesungen bei Grenze 0 sind grün')
  assert.equal(lauf(eine, grenze(0)).status, 1, 'Grenze 0 lässt keine Lesung zu')

  for (const kaputt of ['{', '{}', JSON.stringify({ grenze: '21' }), grenze(-1)]) {
    const r = lauf(eine, kaputt)
    assert.equal(r.status, 1, `Grenzdatei ${kaputt} ist rot`)
    assert.match(r.stderr, /✖/, 'mit Fehlertext, nicht nur Exit 1')
  }
  const ohneQuelle = spawnSync(process.execPath, [werkzeug, '--datei', join(ordner, 'gibt-es-nicht.ts')], { encoding: 'utf8', timeout: 30_000 })
  assert.equal(ohneQuelle.status, 1, 'fehlende Quelldatei ist rot')
  assert.match(ohneQuelle.stderr, /nicht prüfbar/)

  const echt = spawnSync(process.execPath, [werkzeug], { encoding: 'utf8', timeout: 30_000 })
  assert.equal(echt.status, 0, `echter Stand liegt in der Grenze: ${echt.stderr}`)
  console.log(`quelltext-lesungen.test: ok — ${echt.stdout.trim()}`)
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
