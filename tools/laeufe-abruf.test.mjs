// Prüft, dass das D1-Tageslimit (Worker antwortet 503 mit JSON, oder 1101 als HTML/Text) eine klare Zeile ergibt
// statt eines JSON-Stacktraces, und dass `laeufe-aufraeumen.mjs --trocken` dabei mit Exit 0 endet. Kein Netz, kein Token.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { holeLaeufe } from './laeufe-abruf.mjs'

const antwort = (status, text) => async () => new Response(text, { status })

const KONTINGENT = /\(D1-Tageslimit erreicht, Reset 00:00 UTC\)/

// Form wie worker/src/auffangnetz.ts beim Tageslimit: 503, JSON mit error, Retry-After bis 00:00 UTC.
const tageslimit = async () =>
  new Response(JSON.stringify({ error: 'Der Dienst macht gerade Pause. Versuch es später noch einmal.' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json', 'Retry-After': '3600' },
  })
const limit = await holeLaeufe(tageslimit, 'x')
assert.equal(limit.liste, undefined)
assert.equal(limit.meldung, 'Status-Worker antwortet 503 (D1-Tageslimit erreicht, Reset 00:00 UTC) — nichts aufgeräumt')

// Cloudflare-Fehlerseite „1101“ (Text oder HTML) deutet ebenfalls auf das Kontingent.
const html = await holeLaeufe(antwort(500, '<html><body>error code: 1101</body></html>'), 'x')
assert.equal(html.liste, undefined)
assert.match(html.meldung, /^Status-Worker antwortet 500 /)
assert.match(html.meldung, KONTINGENT)

// Jeder andere Fehler: nur die Statuszeile, kein Kontingent-Hinweis (JSON wie vom Auffangnetz, aber 500).
const ANDERER = 'Status-Worker antwortet 500 — nichts aufgeräumt'
const fehlerJson = await holeLaeufe(antwort(500, '{"error":"Das hat gerade nicht geklappt. Versuch es später noch einmal."}'), 'x')
assert.equal(fehlerJson.meldung, ANDERER)
assert.equal((await holeLaeufe(antwort(500, 'Internal Server Error'), 'x')).meldung, ANDERER)

const kaputt200 = await holeLaeufe(antwort(200, '<html>keine Liste</html>'), 'x')
assert.equal(kaputt200.meldung, 'Status-Worker antwortet 200 — nichts aufgeräumt')

const netz = await holeLaeufe(async () => { throw new Error('getaddrinfo ENOTFOUND') }, 'x')
assert.match(netz.meldung, /nicht erreichbar \(getaddrinfo ENOTFOUND\)/)
assert.equal(netz.liste, undefined)

assert.deepEqual((await holeLaeufe(antwort(200, '[{"lauf_id":1}]'), 'x')).liste, [{ lauf_id: 1 }])
assert.deepEqual((await holeLaeufe(antwort(200, '{"laeufe":[{"lauf_id":2}]}'), 'x')).liste, [{ lauf_id: 2 }])

// Das ganze Werkzeug mit untergeschobenem fetch (500 + HTML): Meldung ohne Stacktrace, Exit 0 nur bei --trocken.
const vorlauf = 'data:text/javascript,globalThis.fetch=async()=>new Response("<html>error code: 1101</html>",{status:500})'
const werkzeug = fileURLToPath(new URL('./laeufe-aufraeumen.mjs', import.meta.url))
const lauf = (...args) =>
  spawnSync(process.execPath, ['--import', vorlauf, werkzeug, ...args], {
    encoding: 'utf8',
    env: { ...process.env, LAUF_TOKEN: '' },
  })
const trocken = lauf('--trocken')
assert.equal(trocken.status, 0)
assert.match(trocken.stderr, /Status-Worker antwortet 500/)
assert.doesNotMatch(trocken.stderr, /SyntaxError|\n\s+at /)
assert.equal(lauf().status, 1)

console.log('laeufe-abruf: ok')
