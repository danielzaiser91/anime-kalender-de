// Prüft, dass ein erschöpftes D1-Kontingent (Worker antwortet 500/1101 mit HTML oder Text) eine klare Zeile ergibt
// statt eines JSON-Stacktraces, und dass `laeufe-aufraeumen.mjs --trocken` dabei mit Exit 0 endet. Kein Netz, kein Token.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { holeLaeufe } from './laeufe-abruf.mjs'

const antwort = (status, text) => async () => new Response(text, { status })

const html = await holeLaeufe(antwort(500, '<html><body>error code: 1101</body></html>'), 'x')
assert.equal(html.liste, undefined)
assert.match(html.meldung, /^Status-Worker antwortet 500 \(D1-Kontingent vermutlich erschöpft, Reset 02:00\) — nichts aufgeräumt$/)

const text = await holeLaeufe(antwort(503, 'error code: 1101'), 'x')
assert.match(text.meldung, /antwortet 503/)

const fehlerJson = await holeLaeufe(antwort(500, '{"error":"D1 limit"}'), 'x')
assert.match(fehlerJson.meldung, /antwortet 500/)

const kaputt200 = await holeLaeufe(antwort(200, '<html>keine Liste</html>'), 'x')
assert.match(kaputt200.meldung, /antwortet 200/)

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
