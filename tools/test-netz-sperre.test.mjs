/* Wächter: jeder tools/*.test.* mit Playwright, der Dateien aus extension/ lädt, sperrt das Netz (sperreNetz);
 * dazu die Sperre selbst gegen eine Seiten-Attrappe. Aufruf: node tools/test-netz-sperre.test.mjs */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sperreFehlt, sperreNetz } from './test-netz-sperre.mjs'

const tools = import.meta.dirname

/* Sperre: Attrappe führt die registrierte Route für Anfragen aus; Worker-Adresse wird beantwortet, nicht durchgelassen. */
const routen = []
const seite = { route: async (muster, h) => routen.push({ muster, h }) }
const abgefangen = await sperreNetz(seite)
assert.equal(routen.length, 1)
assert.equal(routen[0].muster, '**/*')
let antwort = null
let fortgesetzt = 0
const anfrage = (url) => ({
  request: () => ({ url: () => url }),
  fulfill: (a) => { antwort = a },
  continue: () => { fortgesetzt++ },
  fallback: () => { fortgesetzt++ },
})
await routen[0].h(anfrage('https://newsletter.animekalender.workers.dev/pruefung?gemeldet=1'))
await routen[0].h(anfrage('https://example.org/x'))
assert.deepEqual(abgefangen, ['https://newsletter.animekalender.workers.dev/pruefung?gemeldet=1', 'https://example.org/x'])
assert.equal(fortgesetzt, 0, 'keine Anfrage geht nach außen')
assert.equal(antwort.body, '{}')

/* Erkennung: jede Teilbedingung allein. */
const PW = "import { chromium } from 'play" + "wright'\n"
const EXT = "const EXT = resolve(import.meta.dirname, '..', 'extension')\n"
assert.equal(sperreFehlt(PW + EXT), true)
assert.equal(sperreFehlt(PW + "readFileSync('extension/melder.js')"), true)
assert.equal(sperreFehlt('const { chromium } = await import("play' + 'wright")\n' + EXT), true)
assert.equal(sperreFehlt(PW + EXT + 'await sperreNetz(seite)'), false)
assert.equal(sperreFehlt(PW), false, 'Playwright ohne Erweiterung')
assert.equal(sperreFehlt(EXT), false, 'Erweiterung ohne Browser')
assert.equal(sperreFehlt(PW + EXT + '// sperreNetz fehlt'), true, 'nur der Aufruf zählt')

const test = readdirSync(tools).filter((f) => /\.test\.(mjs|cjs|ts)$/.test(f))
const ohne = test.filter((f) => sperreFehlt(readFileSync(join(tools, f), 'utf8')))
assert.deepEqual(ohne, [], `Browser-Test mit Erweiterung ohne Netz-Sperre: ${ohne.join(', ')}`)
console.log(`test-netz-sperre: ok (${test.length} Tests geprüft, ohne Sperre: ${ohne.length}; Sperre fängt workers.dev ab)`)
