/* Wächter: jeder tools/*.test.mjs mit Playwright-Import hat die Browser-Weiche; dazu die Weiche selbst. */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { entscheide, weicheFehlt, browserDa } from './browser-weiche.mjs'

const tools = dirname(fileURLToPath(import.meta.url))

// Weiche: Browser da -> laufen; fehlt -> Deploy überspringt, PR-Kette fällt durch (Kontrolle: andere Workflow-Namen).
assert.equal(entscheide(true, {}), 'laufen')
assert.equal(entscheide(true, { GITHUB_WORKFLOW: 'PR-Prüfkette' }), 'laufen')
assert.equal(entscheide(false, {}), 'ueberspringen')
assert.equal(entscheide(false, { GITHUB_WORKFLOW: 'Deploy' }), 'ueberspringen')
assert.equal(entscheide(false, { GITHUB_WORKFLOW: 'PR-Prüfkette' }), 'fehler')
const ohneBrowser = { executablePath: () => join(tools, 'gibt-es-nicht', 'chrome') }
assert.equal(browserDa('probe', ohneBrowser, {}), false)
assert.equal(process.exitCode, undefined, 'Überspringen setzt keinen Fehlercode')

// Erkennung: ohne Weiche rot, mit Weiche grün, ohne Playwright egal.
assert.equal(weicheFehlt("import { chromium } from 'playwright'\n"), true)
assert.equal(weicheFehlt('const { chromium } = await import("playwright")'), true)
assert.equal(weicheFehlt("import { chromium } from 'playwright'\nimport { browserDa } from './browser-weiche.mjs'"), false)
assert.equal(weicheFehlt("import assert from 'node:assert'"), false)

const test = readdirSync(tools).filter((f) => f.endsWith('.test.mjs'))
const ohne = test.filter((f) => weicheFehlt(readFileSync(join(tools, f), 'utf8')))
assert.deepEqual(ohne, [], `Playwright ohne Browser-Weiche: ${ohne.join(', ')}`)
console.log(`browser-weiche: ok (${test.length} Tests geprüft, ohne Weiche: ${ohne.length})`)
