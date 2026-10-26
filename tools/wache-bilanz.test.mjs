// Schlusszeilen der Wache: ruhig, Alarm, Ausfall je Prüfung; Verdrahtung in laeufe-aufraeumen als Prozess (gh als Kulisse).
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { wacheZeilen } from './wache-bilanz.mjs'

const RUHIG_ROT = ['Bestandsbau: kein Alarm (letzter grüner Lauf x, 0 rote/abgebrochene danach)', 'Deploy: kein Alarm']
const NAMEN = 'Bestandsbau, Fehlerschritte, Deploy, Quellen'

// Ruhig: vier Prüfungen, genau eine Zeile.
assert.deepEqual(wacheZeilen(RUHIG_ROT, []), [`WACHE ruhig: 4 Prüfungen ohne Alarm (${NAMEN})`])
// Jede Alarmart unterdrückt die Entwarnung.
assert.deepEqual(wacheZeilen(['ALARM Bestandsbau seit 7.0 h rot (x)', 'Deploy: kein Alarm'], []), [])
assert.deepEqual(wacheZeilen(['ALARM Bestandsbau seit 2.0 h rot mit 2 verschiedenen Fehlerschritten (a; b)', 'Deploy: kein Alarm'], []), [])
assert.deepEqual(wacheZeilen(['Bestandsbau: kein Alarm (x)', 'ALARM Deploy seit 7.0 h ohne Erfolg (x)'], []), [])
assert.deepEqual(wacheZeilen(RUHIG_ROT, ['ALARM Quelle a seit 20.0 Tagen ohne Erfolg (x)']), [])
// Ausfall je Prüfung: eigene Zeile mit Grund, nie ruhig mitgezählt.
assert.deepEqual(wacheZeilen(['Bestandsbau: kein Alarm (x)', 'ALARM? Läufe des Deploys nicht lesbar: deploy kaputt'], []), [
  'WACHE nicht geprüft: Deploy (deploy kaputt)',
  'WACHE ruhig: 3 Prüfungen ohne Alarm (Bestandsbau, Fehlerschritte, Quellen)',
])
assert.deepEqual(wacheZeilen(['ALARM? Läufe des Bestandsbaus nicht lesbar: a', 'ALARM? Fehlerschritte des Bestandsbaus nicht lesbar: b', 'Deploy: kein Alarm'], ['ALARM? g.json nicht lesbar: c']), [
  'WACHE nicht geprüft: Bestandsbau (a)',
  'WACHE nicht geprüft: Fehlerschritte (b)',
  'WACHE nicht geprüft: Quellen (g.json nicht lesbar: c)',
  'WACHE ruhig: 1 Prüfungen ohne Alarm (Deploy)',
])
// Nichts lief: keine Entwarnung.
const alles = ['ALARM? Läufe des Bestandsbaus nicht lesbar: a', 'ALARM? Fehlerschritte des Bestandsbaus nicht lesbar: a', 'ALARM? Läufe des Deploys nicht lesbar: a']
assert.equal(wacheZeilen(alles, ['ALARM? q']).some((z) => z.startsWith('WACHE ruhig')), false)
// Ausfall plus echter Alarm: Ausfall bleibt sichtbar, ruhig fehlt.
assert.deepEqual(wacheZeilen(['ALARM Bestandsbau seit 7.0 h rot (x)', 'ALARM? Läufe des Deploys nicht lesbar: d'], []), ['WACHE nicht geprüft: Deploy (d)'])

// Verdrahtung: der echte Aufrufer. Datum 2999 liegt in der Zukunft (grün, frisch), 2026-10-18 weit zurück.
const stub = (laeufe) =>
  `data:text/javascript,import cp from "node:child_process";import{syncBuiltinESMExports}from "node:module";cp.execFileSync=()=>{if(${laeufe === null})throw new Error("gh weg");return ${JSON.stringify(JSON.stringify(laeufe))}};syncBuiltinESMExports();globalThis.fetch=async()=>new Response("{}",{status:500})`
const lauf = (conclusion, createdAt) => ({ status: 'completed', conclusion, createdAt, databaseId: 1 })
const wegwerf = mkdtempSync(join(tmpdir(), 'wache-bilanz-'))
try {
  const aufraeumen = fileURLToPath(new URL('./laeufe-aufraeumen.mjs', import.meta.url))
  const datei = join(wegwerf, 'g.json')
  writeFileSync(datei, '{}')
  const fahre = (laeufe, gesundheit = datei) =>
    spawnSync(process.execPath, ['--import', stub(laeufe), aufraeumen, '--trocken', '--gesundheit', gesundheit], { encoding: 'utf8', env: { ...process.env, LAUF_TOKEN: '' } })
  const letzteZeile = (r) => r.stdout.trim().split('\n').at(-1)

  const ruhig = fahre([lauf('success', '2999-12-31T01:00:00Z')])
  assert.equal(ruhig.status, 0, ruhig.stderr)
  assert.equal(letzteZeile(ruhig), `WACHE ruhig: 4 Prüfungen ohne Alarm (${NAMEN})`)
  assert.notEqual(ruhig.stderr.trim(), '', 'der Lauf-Teil lief vor der Schlusszeile (Worker-Meldung)')

  const alarm = fahre([lauf('success', '2026-10-18T01:00:00Z'), lauf('failure', '2026-10-18T02:00:00Z')])
  assert.match(alarm.stdout, /^ALARM Bestandsbau/m)
  assert.doesNotMatch(alarm.stdout, /WACHE ruhig/)

  const ausfall = fahre(null)
  assert.equal(ausfall.status, 0, ausfall.stderr)
  assert.match(ausfall.stdout, /^WACHE nicht geprüft: Bestandsbau \(gh weg\)$/m)
  assert.match(ausfall.stdout, /^WACHE nicht geprüft: Deploy \(gh weg\)$/m)
  assert.equal(letzteZeile(ausfall), 'WACHE ruhig: 1 Prüfungen ohne Alarm (Quellen)')

  const ohneDatei = fahre([lauf('success', '2999-12-31T01:00:00Z')], join(wegwerf, 'fehlt.json'))
  assert.match(ohneDatei.stdout, /^WACHE nicht geprüft: Quellen \(/m)
  assert.doesNotMatch(ohneDatei.stdout, /WACHE ruhig: 4/)
} finally {
  rmSync(wegwerf, { recursive: true, force: true })
}
console.log('wache-bilanz: ok (ruhig, 4 Alarmarten, Ausfall je Prüfung, nichts gelaufen, laeufe-aufraeumen als Prozess)')
