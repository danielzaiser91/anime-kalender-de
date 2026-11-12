// Prozesstest des Wächters gegen eine Wegwerf-Wurzel (Kopie von extension/*.js und tsconfig).
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const hier = path.dirname(fileURLToPath(import.meta.url))
const echt = path.join(hier, '..')
const wacht = path.join(hier, 'extension-ts-liste-pruefen.mjs')
const wurzel = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-ts-liste-'))
const ordner = path.join(wurzel, 'extension')
fs.mkdirSync(ordner)
for (const f of fs.readdirSync(path.join(echt, 'extension'))) {
  if (f.endsWith('.js') || f === 'tsconfig.json') fs.writeFileSync(path.join(ordner, f), '')
  if (f === 'tsconfig.json') fs.copyFileSync(path.join(echt, 'extension', f), path.join(ordner, f))
}

function lauf() {
  const r = spawnSync(process.execPath, [wacht, wurzel], { encoding: 'utf8', timeout: 20000, windowsHide: true })
  return { code: r.status, aus: `${r.stdout}${r.stderr}` }
}
const tsconfig = path.join(ordner, 'tsconfig.json')
const original = fs.readFileSync(tsconfig, 'utf8')

const a = lauf()
assert.equal(a.code, 0, a.aus)
assert.match(a.aus, /22 Ausnahmen, 0 Fehler/)

fs.writeFileSync(path.join(ordner, 'neu-x.js'), '')
const b = lauf()
assert.equal(b.code, 1, b.aus)
assert.match(b.aus, /neu-x\.js: weder in/)
fs.writeFileSync(tsconfig, original.replace('"adn-senden.js",', '"adn-senden.js",\n    "neu-x.js",'))
const c = lauf()
assert.equal(c.code, 0, c.aus)
fs.writeFileSync(tsconfig, original)
fs.rmSync(path.join(ordner, 'neu-x.js'))

// erzeugte offene-*.js zählen nicht
fs.writeFileSync(path.join(ordner, 'offene-neu.js'), '')
assert.equal(lauf().code, 0)
fs.rmSync(path.join(ordner, 'offene-neu.js'))

// Datei aus include gestrichen (und nicht in Ausnahmen) -> rot
fs.writeFileSync(tsconfig, original.replace('    "adn-senden.js",\n', ''))
const d = lauf()
assert.equal(d.code, 1, d.aus)
assert.match(d.aus, /adn-senden\.js: weder in/)

// Ausnahme-Datei in include aufgenommen -> rot (Ausnahme muss schrumpfen)
fs.writeFileSync(tsconfig, original.replace('"adn-senden.js",', '"adn-senden.js",\n    "box.js",'))
const e = lauf()
assert.equal(e.code, 1, e.aus)
assert.match(e.aus, /box\.js: steht in include und in AUSNAHMEN/)
fs.writeFileSync(tsconfig, original)

// Ausnahme-Datei gelöscht -> rot
fs.rmSync(path.join(ordner, 'box.js'))
const f = lauf()
assert.equal(f.code, 1, f.aus)
assert.match(f.aus, /box\.js: Ausnahme ohne Datei/)

fs.rmSync(wurzel, { recursive: true, force: true })
console.log('extension-ts-liste-pruefen.test: 6 Fälle grün (neue Datei, include, offene-*, gestrichen, Ausnahme in include, Ausnahme ohne Datei)')
