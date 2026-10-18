// Prüft, dass das D1-Tageslimit (Worker antwortet 503 mit JSON, oder 1101 als HTML/Text) eine klare Zeile ergibt
// statt eines JSON-Stacktraces, und dass `laeufe-aufraeumen.mjs --trocken` dabei mit Exit 0 endet. Kein Netz, kein Token.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { holeLaeufe, letzteDatenAenderung, roteArten, stillstand, STILLSTAND_GRENZE_STUNDEN } from './laeufe-abruf.mjs'

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
assert.match(trocken.stdout, /^STILLSTAND\? Letzte Änderung von public\/data nicht lesbar/)
assert.match(trocken.stderr, /Status-Worker antwortet 500/)
assert.doesNotMatch(trocken.stderr, /SyntaxError|\n\s+at /)
assert.equal(lauf().status, 1)

// Rote Läufe stehen nur im Verlauf (neuester zuletzt): Treffer vorn, in der Mitte und hinten, dazu Gegenfälle.
const eintrag = (z, am) => ({ z, am })
const verlauf = {
  A: [eintrag('fehler', '1'), eintrag('ok', '2')],
  B: [eintrag('ok', '3'), eintrag('fehler', '4'), eintrag('laeuft', '5')],
  C: [eintrag('ok', '6'), eintrag('laeuft', '7')],
  D: [eintrag('fehler', '8'), eintrag('warnung', '9'), eintrag('ok', '10'), eintrag('warnung', '11')],
  E: [eintrag('abgebrochen', '12')],
}
assert.deepEqual(roteArten(verlauf), [
  { art: 'B', zustand: 'fehler', am: '4' },
  { art: 'D', zustand: 'warnung', am: '11' },
])
assert.deepEqual(roteArten(undefined), [])

// Das ganze Werkzeug: Liste leer (nichts läuft), Verlauf mit rotem Bestandsbau -> die Zeile erscheint, auch bei --trocken.
const rotAntwort = JSON.stringify({ laeufe: [], verlauf: { Bestand: [eintrag('ok', 'x'), eintrag('fehler', 'y')], Sammler: [eintrag('ok', 'z')] } })
const STUNDE = 3_600_000
const mitCommitVor = (stunden) => {
  const datum = new Date(Date.now() - stunden * STUNDE).toISOString()
  const commits = JSON.stringify([{ commit: { committer: { date: datum } } }, { commit: { committer: { date: '2000-01-01T00:00:00Z' } } }])
  const stub = `globalThis.fetch=async(u)=>String(u).startsWith("https://api.github.com/repos/danielzaiser91/anime-kalender-de/commits?path=public/data&per_page=1")?new Response(${JSON.stringify(commits)},{status:200}):new Response(${JSON.stringify(rotAntwort)},{status:200})`
  return spawnSync(process.execPath, ['--import', `data:text/javascript,${stub}`, werkzeug, '--trocken'], { encoding: 'utf8' })
}
const rot = mitCommitVor(20)
assert.equal(rot.status, 0)
assert.match(rot.stdout, /0 rot\nROT im Verlauf: Bestand — letzter Lauf fehler am y\n/)
assert.doesNotMatch(rot.stdout, /Sammler/)

assert.match(rot.stdout, /^STILLSTAND: public\/data seit 20\.0 h unverändert \(Grenze 8 h, letzter Commit /)
assert.doesNotMatch(mitCommitVor(7).stdout, /STILLSTAND/)

// Grenze: genau 8 h noch in Ordnung, eine Sekunde mehr nicht.
const jetzt = Date.parse('2026-10-18T12:00:00Z')
assert.equal(STILLSTAND_GRENZE_STUNDEN, 8)
assert.equal(stillstand('2026-10-18T04:00:00Z', jetzt).zuLang, false)
assert.equal(stillstand('2026-10-18T03:59:59Z', jetzt).zuLang, true)
assert.equal(stillstand('2026-10-18T11:00:00Z', jetzt).stunden, 1)

// Die Abfrage nimmt den ersten (neuesten) Commit und fragt genau `public/data`; unlesbar ergibt `undefined`.
let gefragt = ''
const kulisse = async (u) => {
  gefragt = u
  return new Response(JSON.stringify([{ commit: { committer: { date: 'A' } } }, { commit: { committer: { date: 'B' } } }]))
}
assert.equal(await letzteDatenAenderung(kulisse, 'o/r'), 'A')
assert.equal(gefragt, 'https://api.github.com/repos/o/r/commits?path=public/data&per_page=1')
assert.equal(await letzteDatenAenderung(async () => new Response('[]'), 'o/r'), undefined)
assert.equal(await letzteDatenAenderung(async () => { throw new Error('netz') }, 'o/r'), undefined)

console.log('laeufe-abruf: ok')
