/**
 * Test zum Live-Modus von `kachel-ecken-messen.mjs` (`--live`): Adresse, Weiche je Anfrage, Route-Handler, Seiten-Einstellung
 * (Service Worker gesperrt, Handler eingehängt), Datenstand-Abruf und der Prozess ohne `dist/`. Kein Netz, kein Browser.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { antworteLive, ERSATZ_SVG, LIVE_STANDARD, liveAktion, liveArgument, liveDatenstand } from './kachel-ecken-live.mjs'

// Adresse aus den Argumenten.
assert.equal(liveArgument(['node', 'x']), undefined, 'ohne --live kein Live-Modus')
assert.equal(liveArgument(['node', 'x', '--live']), LIVE_STANDARD, 'ohne Adresse der Standard')
assert.equal(liveArgument(['node', 'x', '--live', '--bilder', 'b']), LIVE_STANDARD, 'ein folgendes Argument mit -- ist keine Adresse')
assert.equal(liveArgument(['node', 'x', '--live', 'https://live.test/']), 'https://live.test', 'Schrägstrich am Ende fällt weg')
assert.equal(liveArgument(['node', 'x', '--live', 'http://127.0.0.1:8080/pfad']), 'http://127.0.0.1:8080', 'Port bleibt, Pfad fällt weg')
assert.throws(() => liveArgument(['node', 'x', '--live', 'file:///C:/x']), /nur http/, 'file: ist kein Live-Ziel')
assert.equal(LIVE_STANDARD, 'https://anime-kalender.de', 'Standard ist die echte Seite')

// Weiche je Anfrage.
const B = 'https://live.test'
assert.equal(liveAktion(`${B}/assets/app.js`, B), 'weiter', 'eigener Code')
assert.equal(liveAktion(`${B}/data/titles.json`, B), 'weiter', 'eigene Daten')
assert.equal(liveAktion(`${B}/data/events.json`, B), 'kulisse', 'events.json bekommt die Kulisse')
assert.equal(liveAktion(`${B}/data/events.json.map`, B), 'weiter', 'nur events.json selbst')
assert.equal(liveAktion('https://s4.anilist.co/file/cover.jpg', B), 'ersatz', 'fremdes Cover')
assert.equal(liveAktion('https://live.test.evil.example/x.png', B), 'ersatz', 'ähnlicher Name ist fremd')
assert.equal(liveAktion('http://live.test/x.png', B), 'ersatz', 'anderes Schema ist fremd')
assert.equal(liveAktion('https://other.test/data/events.json', B), 'ersatz', 'events.json fremder Herkunft bleibt Ersatz')
assert.equal(liveAktion('data:image/png;base64,AAAA', B), 'ignorieren', 'data: wird nicht angefasst')

// Route-Handler mit Attrappen: Aufrufe protokollieren.
const attrappe = (url, geholt = '[1]') => {
  const log = []
  const route = {
    request: () => ({ url: () => url }),
    continue: async () => log.push(['continue']),
    fulfill: async (o) => log.push(['fulfill', o]),
    fetch: async () => {
      log.push(['fetch'])
      return { body: async () => Buffer.from(geholt), id: 'antwort' }
    },
  }
  return { route, log }
}
const kulisse = (inhalt) => `K:${inhalt}`
let a = attrappe('https://s4.anilist.co/c.jpg')
await antworteLive(a.route, B, kulisse)
assert.deepEqual(a.log.map((z) => z[0]), ['fulfill'], 'fremdes Bild: nur Ersatz, kein Abruf')
assert.equal(a.log[0][1].body, ERSATZ_SVG)
assert.equal(a.log[0][1].contentType, 'image/svg+xml')
assert.match(ERSATZ_SVG, /^<svg .*fill="#4a5a80"/, 'fester Ersatz')
a = attrappe(`${B}/assets/app.js`)
await antworteLive(a.route, B, kulisse)
assert.deepEqual(a.log, [['continue']], 'eigene Datei: unverändert weiter')
a = attrappe(`${B}/data/events.json`, 'echt')
await antworteLive(a.route, B, kulisse)
assert.deepEqual(a.log.map((z) => z[0]), ['fetch', 'fulfill'], 'events.json: abrufen, dann ersetzen')
assert.equal(a.log[1][1].body, 'K:echt', 'Körper kommt aus der Kulisse')
assert.equal(a.log[1][1].response.id, 'antwort', 'Kopfzeilen der echten Antwort bleiben')
a = attrappe('data:text/plain,x')
await antworteLive(a.route, B, kulisse)
assert.deepEqual(a.log, [['continue']], 'data: geht weiter')

// Datenstand: jeder Nicht-Erfolg ist ein Fehlertext (nie still eine Woche raten).
const antwort = (status, daten, wirf) => async () => {
  if (wirf) throw new Error(wirf)
  return { ok: status < 400, status, json: async () => daten }
}
assert.deepEqual(await liveDatenstand(B, antwort(200, { generatedAt: '2026-10-30T20:33:47.793Z' })), { erzeugt: '2026-10-30T20:33:47.793Z' })
assert.match((await liveDatenstand(B, antwort(404, {}))).fehler, /antwortet mit 404/, '404')
assert.match((await liveDatenstand(B, antwort(503, {}))).fehler, /antwortet mit 503/, '503')
assert.match((await liveDatenstand(B, antwort(200, { generatedAt: 5 }))).fehler, /ohne generatedAt/, 'falscher Typ')
assert.match((await liveDatenstand(B, antwort(200, {}))).fehler, /ohne generatedAt/, 'Feld fehlt')
assert.match((await liveDatenstand(B, antwort(200, null, 'fetch failed'))).fehler, /nicht lesbar \(fetch failed\)/, 'Netzfehler')
let angefragt
await liveDatenstand(B, async (u) => {
  angefragt = u
  return { ok: true, status: 200, json: async () => ({ generatedAt: 'x' }) }
})
assert.equal(angefragt, `${B}/data/meta.json`, 'meta.json der Live-Adresse')

// Seite: Service Worker gesperrt, Handler eingehängt (das Werkzeug liest `--live` beim Laden).
process.argv.push('--live', B)
const { lieseDatenstand, neueSeite } = await import('./kachel-ecken-messen.mjs')
const optionen = []
const routen = []
const browser = {
  newContext: async (o) => {
    optionen.push(o)
    return { addInitScript: async () => {}, newPage: async () => ({ route: async (muster, h) => routen.push([muster, h]) }) }
  },
}
await neueSeite(browser, 'dunkel', [])
await neueSeite(browser, 'hell', [], true)
assert.deepEqual(optionen.map((o) => o.serviceWorkers), ['block', 'block'], 'Desktop und Handy ohne Service Worker')
assert.equal(routen.length, 2, 'Handler an beiden Seiten')
a = attrappe('https://s4.anilist.co/c.jpg')
await routen[0][1](a.route)
assert.equal(a.log[0][1].body, ERSATZ_SVG, 'der eingehängte Handler ersetzt fremde Bilder')
a = attrappe(`${B}/assets/app.js`)
await routen[1][1](a.route)
assert.deepEqual(a.log, [['continue']], 'der eingehängte Handler reicht Eigenes durch')
a = attrappe(`${B}/data/events.json`, '[{"a": 1}]')
await routen[1][1](a.route)
assert.equal(a.log[1][1].body, '[{"a":1}]', 'events.json läuft durch die Saal-Kulisse (neu serialisiert, nicht der rohe Körper)')

// Datenstand der Messwoche kommt im Live-Modus von der Live-Adresse, nicht aus dist/.
const echterAbruf = globalThis.fetch
const abgerufen = []
globalThis.fetch = async (u) => {
  abgerufen.push(u)
  return { ok: true, status: 200, json: async () => ({ generatedAt: '2026-10-30T20:33:47.793Z' }) }
}
try {
  assert.deepEqual(await lieseDatenstand(), { erzeugt: '2026-10-30T20:33:47.793Z' }, 'Datenstand der Live-Seite')
} finally {
  globalThis.fetch = echterAbruf
}
assert.deepEqual(abgerufen, [`${B}/data/meta.json`], 'genau ein Abruf, an der Live-Adresse')

// Prozess: Live braucht kein dist/ und keine Quellen; ohne --live endet derselbe Aufruf mit „dist/ fehlt“. Die Messung kommt aus einer Datei (kein Browser).
const quelle = path.dirname(fileURLToPath(import.meta.url))
const wurzel = mkdtempSync(path.join(os.tmpdir(), 'kachel-live-'))
try {
  mkdirSync(path.join(wurzel, 'tools'))
  mkdirSync(path.join(wurzel, 'web', 'src'), { recursive: true })
  for (const datei of ['kachel-ecken-messen.mjs', 'kachel-ecken-live.mjs', 'dist-frisch.mjs']) copyFileSync(path.join(quelle, datei), path.join(wurzel, 'tools', datei))
  symlinkSync(path.join(quelle, '..', 'node_modules'), path.join(wurzel, 'node_modules'), 'junction')
  const zeilen = ['dunkel', 'hell'].flatMap((t) => ['woche', 'monat', 'fenster', 'handy'].map((n) => ({ fehler: [], zeile: `${t}/${n}: 3 Kacheln, 0 Fehler` })))
  const ok = path.join(wurzel, 'ok.json')
  const rot = path.join(wurzel, 'rot.json')
  writeFileSync(ok, JSON.stringify(zeilen))
  writeFileSync(rot, JSON.stringify(zeilen.map((z, i) => (i === 1 ? { fehler: ['dunkel/monat: Leiste sitzt 2.00 px tiefer'], zeile: z.zeile } : z))))
  const skript = path.join(wurzel, 'tools', 'kachel-ecken-messen.mjs')
  const starte = (...args) => spawnSync(process.execPath, [skript, ...args], { cwd: wurzel, encoding: 'utf8', timeout: 60000 })
  const live = starte('--live', 'http://127.0.0.1:9', '--messung', ok)
  assert.equal(live.status, 0, `live ohne dist/: Exit 0 (stderr: ${live.stderr})`)
  assert.match(live.stdout, /Kachel-Ecken: Leiste sitzt/, 'Erfolgszeile')
  const kaputt = starte('--live', 'http://127.0.0.1:9', '--messung', rot)
  assert.equal(kaputt.status, 1, `live mit kaputtem Rand: Exit 1 (stderr: ${kaputt.stderr})`)
  assert.match(kaputt.stderr, /1 Fehler[\s\S]*Leiste sitzt 2\.00 px tiefer/, 'Befund steht im Log')
  const ohneLive = starte('--messung', ok)
  assert.equal(ohneLive.status, 1, 'ohne --live fehlt dist/')
  assert.match(ohneLive.stderr, /dist\/ fehlt/, 'Gegenprobe: das dist-Tor greift ohne --live')
  const schlecht = starte('--live', 'file:///C:/x', '--messung', ok)
  assert.notEqual(schlecht.status, 0, 'file: als Live-Ziel bricht ab')
  assert.match(schlecht.stderr, /nur http/, 'Meldung nennt den Grund')
} finally {
  unlinkSync(path.join(wurzel, 'node_modules'))
  rmSync(wurzel, { recursive: true, force: true })
}

console.log('kachel-ecken-live.test: ok')
