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
assert.match(trocken.stdout, /^STILLSTAND\? Letzte Änderung von public\/data nicht lesbar/m)
assert.match(trocken.stderr, /Status-Worker antwortet 500/)
assert.doesNotMatch(trocken.stderr, /SyntaxError|\n\s+at /)
assert.equal(lauf().status, 1)

// Rote Läufe stehen nur im Verlauf (neuester zuletzt): Treffer vorn, in der Mitte und hinten, dazu Gegenfälle.
const eintrag = (z, am) => ({ z, am })
const T = (stunde) => `2026-10-18T${String(stunde).padStart(2, '0')}:00:00Z`
const verlauf = {
  A: [eintrag('fehler', T(1)), eintrag('ok', T(2))],
  B: [eintrag('ok', T(3)), eintrag('fehler', T(4)), eintrag('laeuft', T(5))],
  C: [eintrag('ok', T(6)), eintrag('laeuft', T(7))],
  G: [eintrag('ok', T(1)), eintrag('fehler', T(8))],
  D: [eintrag('fehler', T(8)), eintrag('warnung', T(9)), eintrag('ok', T(10)), eintrag('warnung', T(11))],
  E: [eintrag('abgebrochen', T(12))],
  F: [eintrag('ok', T(1)), eintrag('fehler', T(2)), eintrag('abgebrochen', T(3))],
  H: [eintrag('ok', T(1)), eintrag('fehler', T(8))],
}
// G: grüner Lauf nach dem Fehler (überholt); H: grüner Lauf davor und einer genau zur Fehlerzeit (nicht überholt).
const gruen = new Map([['G', T(9)], ['H', T(8)]])
const jetztRot = Date.parse(T(14))
assert.deepEqual(roteArten(verlauf, gruen, jetztRot), [
  { art: 'B', zustand: 'fehler', am: T(4), stunden: 10 },
  { art: 'D', zustand: 'warnung', am: T(11), stunden: 3 },
  { art: 'F', zustand: 'fehler', am: T(2), stunden: 12 },
  { art: 'H', zustand: 'fehler', am: T(8), stunden: 6 },
])
assert.deepEqual(roteArten(undefined), [])
assert.equal(roteArten({ G: [eintrag('fehler', T(8))] }, new Map([['G', T(7)]]), jetztRot).length, 1)
assert.equal(roteArten({ G: [eintrag('fehler', T(8))] }, new Map([['G', T(9)]]), jetztRot).length, 0)

// Das ganze Werkzeug: Liste leer (nichts läuft), Verlauf mit rotem Bestandsbau -> die Zeile erscheint, auch bei --trocken.
// `gh run list` und die GitHub-API sind Kulissen; `gh` antwortet nur auf die Frage je Workflow mit `--status success`.
const FEHLERZEIT = '2026-10-18T09:00:00Z'
// Rote App-Läufe (A2): der passende in der Mitte, sein Workflow steht nicht im Verlauf.
const appLauf = (lauf_id, workflow, zustand, gemeldet_am) => ({ lauf_id, workflow, zustand, gemeldet_am })
const appRot = [appLauf(71, 'Andere', 'fehler', '2026-10-18T10:00:00Z'), appLauf(72, 'Nachzügler', 'fehler', '2026-10-18T11:00:00Z'), appLauf(73, 'Nachzügler', 'warnung', '2026-10-18T13:00:00Z')]
const rotAntwort = JSON.stringify({ laeufe: appRot, verlauf: { Bestand: [eintrag('ok', '2026-10-18T08:00:00Z'), eintrag('fehler', FEHLERZEIT)], Sammler: [eintrag('ok', FEHLERZEIT)], 'Claude — roten Datenlauf untersuchen': [eintrag('warnung', FEHLERZEIT)] } })
const STUNDE = 3_600_000
const mitCommitVor = (stunden, gruenAm = '2026-10-17T00:00:00Z', ghWirftFuer = '') => {
  const datum = new Date(Date.now() - stunden * STUNDE).toISOString()
  const commits = JSON.stringify([{ commit: { committer: { date: datum } } }, { commit: { committer: { date: '2000-01-01T00:00:00Z' } } }])
  const laeufe = JSON.stringify([
    { workflowName: 'Sammler', conclusion: 'failure', createdAt: '2026-10-18T23:00:00Z' },
    { workflowName: 'Bestand', conclusion: 'success', createdAt: gruenAm },
    { workflowName: 'Bestand', conclusion: 'failure', createdAt: '2026-10-18T23:30:00Z' },
    { workflowName: 'Nachzügler', conclusion: 'success', createdAt: '2026-10-18T12:00:00Z' },
    { workflowName: 'bestand-bauen.yml', conclusion: 'success', createdAt: gruenAm },
  ])
  const stub =
    'import cp from "node:child_process";import {syncBuiltinESMExports} from "node:module";' +
    `const L=${laeufe};cp.execFileSync=(c,a)=>{const w=a[a.indexOf("--workflow")+1];if(c!=="gh"||a[0]!=="run"||a[1]!=="list"||!a.includes("--workflow")||a[a.indexOf("--status")+1]!=="success"||w===${JSON.stringify(ghWirftFuer)})throw new Error("gh?");return JSON.stringify(L.filter(r=>r.workflowName===w&&r.conclusion==="success").sort((x,y)=>y.createdAt.localeCompare(x.createdAt)).slice(0,1))};syncBuiltinESMExports();` +
    `globalThis.fetch=async(u)=>String(u).startsWith("https://api.github.com/repos/danielzaiser91/anime-kalender-de/commits?path=public/data&per_page=1")?new Response(${JSON.stringify(commits)},{status:200}):new Response(${JSON.stringify(rotAntwort)},{status:200})`
  return spawnSync(process.execPath, ['--import', `data:text/javascript,${stub}`, werkzeug, '--trocken'], { encoding: 'utf8' })
}
const rot = mitCommitVor(20)
assert.equal(rot.status, 0)
assert.match(rot.stdout, /^ROT im Verlauf: Bestand — letzter Lauf fehler am 2026-10-18T09:00:00Z \(vor -?[\d.]+ h, kein grüner Lauf danach\)$/m)
assert.doesNotMatch(rot.stdout, /ROT im Verlauf: Sammler/)
// Untersucher-Warnung: nur der grüne Bestandsbau danach hebt sie auf (der Untersucher selbst hat keine grünen Läufe).
assert.match(rot.stdout, /^ROT im Verlauf: Claude — roten Datenlauf untersuchen /m)
assert.doesNotMatch(mitCommitVor(20, '2026-10-18T09:30:00Z').stdout, /Claude — roten/)
assert.match(mitCommitVor(20, '2026-10-18T09:30:00Z', 'bestand-bauen.yml').stdout, /^ROT im Verlauf: Claude — roten /m)
// Grüner Lauf nach dem Fehler: keine ROT-Zeile (Gegenprobe gegen `gh run list`).
assert.doesNotMatch(mitCommitVor(20, '2026-10-18T09:30:00Z').stdout, /ROT im Verlauf/)
// gh-Ausfall für einen Workflow (A1): der grüne Lauf danach ist unbekannt, die Zeile bleibt.
assert.match(mitCommitVor(20, '2026-10-18T09:30:00Z', 'Bestand').stdout, /^ROT im Verlauf: Bestand /m)
// Rote App-Läufe (A2): nur der mit grünem Lauf danach wird abgenommen, auch ohne Eintrag im Verlauf.
assert.match(rot.stdout, /^ {2}bleibt {3}71 {2}Andere /m)
assert.match(rot.stdout, /^ {2}nimmt ab 72 {2}Nachzügler$/m)
assert.match(rot.stdout, /^ {2}bleibt {3}73 {2}Nachzügler /m)
assert.match(mitCommitVor(20, undefined, 'Nachzügler').stdout, /^ {2}bleibt {3}72 {2}Nachzügler /m)

assert.match(rot.stdout, /^STILLSTAND: public\/data seit 20\.0 h unverändert \(Grenze 8 h, letzter Commit /m)
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


// Fehlerfälle der Abfrage: Rate-Limit (403 mit Objekt), Nicht-JSON, `null`, ungültiges Datum -> `undefined` bzw. Wächter schlägt an.
const limit403 = async () => new Response('{"message":"API rate limit exceeded"}', { status: 403 })
assert.equal(await letzteDatenAenderung(limit403, 'o/r'), undefined)
assert.equal(await letzteDatenAenderung(async () => new Response('<html>Bad gateway</html>', { status: 502 }), 'o/r'), undefined)
assert.equal(await letzteDatenAenderung(async () => new Response('null'), 'o/r'), undefined)
assert.equal(stillstand('kein Datum', jetzt).zuLang, true)

console.log('laeufe-abruf: ok')
