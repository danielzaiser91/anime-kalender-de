// Eskalation stummer Quellen: doppelte Frist als Grenze, Gegenfälle, Daniels Handgriff, Lesefehler, Verdrahtung in laeufe-aufraeumen als Prozess.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { eskalation, eskalationsText, eskalationsZeilen } from './wache-eskalation.mjs'

const JETZT = Date.parse('2026-10-25T12:00:00Z')
const vor = (minuten) => new Date(JETZT - minuten * 60_000).toISOString()
const TAG = 24 * 60

// Genau doppelte Frist (10 Tage bei 5): nein; eine Minute darüber: ja; eine Minute darunter: nein.
assert.equal(eskalation('x', 5, vor(10 * TAG), JETZT).eskalieren, false)
assert.equal(eskalation('x', 5, vor(10 * TAG + 1), JETZT).eskalieren, true)
assert.equal(eskalation('x', 5, vor(10 * TAG - 1), JETZT).eskalieren, false)
// Frist 1 Tag: Grenze 2 Tage, nicht 1 und nicht 3 (Faktor wird mitgemessen).
assert.equal(eskalation('x', 1, vor(2 * TAG + 1), JETZT).eskalieren, true)
assert.equal(eskalation('x', 1, vor(1 * TAG + 1), JETZT).eskalieren, false)
// Ohne Frist (leer, 0, negativ, undefined): nie.
for (const frist of [undefined, null, 0, -3, Number.NaN]) assert.equal(eskalation('x', frist, vor(900 * TAG), JETZT).eskalieren, false)
// Noch nie ein Erfolg (leer, fehlend, unlesbar): eskalieren, Text „noch nie“.
for (const ok of [undefined, '', 'kein Datum']) assert.match(eskalation('x', 5, ok, JETZT).text, /^ALARM Quelle x noch nie ohne Erfolg \(Frist 5 Tage, Eskalation ab 10\)$/)
// Text: Tage mit einer Nachkommastelle, Frist und Grenze verschieden.
assert.equal(eskalation('link-check', 9, vor(19.9 * TAG), JETZT).text, 'ALARM Quelle link-check seit 19.9 Tagen ohne Erfolg (Frist 9 Tage, Eskalation ab 18)')

// Daniels Handgriff: beide CR-Läufe eskalieren mit Hinweis, andere Quellen ohne.
for (const name of ['cr-einzelwerke', 'cr-filmbloecke']) {
  const e = eskalation(name, 21, vor(43 * TAG), JETZT)
  assert.equal(e.eskalieren, true)
  assert.match(e.text, /seit 43\.0 Tagen.*Daniels Handgriff: npm run data:cr-einzelwerke && npm run data:cr-filmbloecke/)
}
assert.doesNotMatch(eskalation('cr-katalog', 21, vor(43 * TAG), JETZT).text, /Handgriff/)
assert.doesNotMatch(eskalation('link-check', 9, vor(43 * TAG), JETZT).text, /Handgriff/)
// Die CR-Läufe unterhalb der doppelten Frist (27 Tage bei 21, die Lage vom 20.10.2026) eskalieren noch nicht.
assert.equal(eskalation('cr-einzelwerke', 21, vor(27 * TAG), JETZT).eskalieren, false)

// Mehrere Quellen: sortiert, Standardfrist 4 Tage (Grenze 8) für Quellen ohne Eintrag, eigene Frist aus der Tabelle.
const stand = {
  zeta: { lastOk: vor(9 * TAG) },
  'link-check': { lastOk: vor(19 * TAG) },
  alpha: { lastOk: vor(7 * TAG) },
  neu: { lastOk: vor(1 * TAG) },
  stumm: {},
  leer: null,
}
const zeilen = eskalationsZeilen(stand, JETZT, { 'link-check': 9 })
assert.equal(zeilen.length, 4)
assert.match(zeilen[0], /^ALARM Quelle leer noch nie/)
assert.match(zeilen[1], /^ALARM Quelle link-check seit 19\.0 Tagen/)
assert.match(zeilen[2], /^ALARM Quelle stumm noch nie/)
assert.match(zeilen[3], /^ALARM Quelle zeta seit 9\.0 Tagen ohne Erfolg \(Frist 4 Tage, Eskalation ab 8\)/)
assert.deepEqual(eskalationsZeilen({}, JETZT), [])

const wegwerf = mkdtempSync(join(tmpdir(), 'wache-eskalation-'))
try {
  // Lesefehler ist selbst eine Zeile.
  assert.match(eskalationsText(join(wegwerf, 'fehlt.json'), JETZT)[0], /^ALARM\? .*fehlt\.json nicht lesbar: /)
  writeFileSync(join(wegwerf, 'kaputt.json'), '{')
  assert.match(eskalationsText(join(wegwerf, 'kaputt.json'), JETZT)[0], /^ALARM\? /)

  // Verdrahtung: der echte Aufrufer mit `gh` und Worker als Kulisse (Datum 2026-01-01 weit zurück, 2999 in der Zukunft).
  const stub = 'data:text/javascript,import cp from "node:child_process";import{syncBuiltinESMExports}from "node:module";cp.execFileSync=()=>{throw new Error("gh?")};syncBuiltinESMExports();globalThis.fetch=async()=>new Response("{}",{status:500})'
  const aufraeumen = fileURLToPath(new URL('./laeufe-aufraeumen.mjs', import.meta.url))
  const fahre = (inhalt) => {
    const datei = join(wegwerf, 'gesundheit.json')
    writeFileSync(datei, JSON.stringify(inhalt))
    return spawnSync(process.execPath, ['--import', stub, aufraeumen, '--trocken', '--gesundheit', datei], { encoding: 'utf8', env: { ...process.env, LAUF_TOKEN: '' } })
  }
  const alt = fahre({ 'cr-einzelwerke': { lastOk: '2026-01-01T00:00:00Z' }, 'cr-filmbloecke': { lastOk: '2026-01-01T00:00:00Z' }, frisch: { lastOk: '2999-12-31T00:00:00Z' } })
  assert.equal(alt.status, 0, alt.stderr)
  assert.match(alt.stdout, /^ALARM Quelle cr-einzelwerke seit \d+\.\d Tagen ohne Erfolg \(Frist 21 Tage.*Daniels Handgriff/m)
  assert.match(alt.stdout, /^ALARM Quelle cr-filmbloecke seit /m)
  assert.doesNotMatch(alt.stdout, /Quelle frisch/)
  assert.doesNotMatch(fahre({ frisch: { lastOk: '2999-12-31T00:00:00Z' } }).stdout, /ALARM Quelle/)
} finally {
  rmSync(wegwerf, { recursive: true, force: true })
}
console.log('wache-eskalation: ok (Grenze doppelte Frist, Gegenfälle, noch nie, CR-Handgriff, Sortierung, Lesefehler, laeufe-aufraeumen als Prozess)')
