// Alarm „Bestandsbau rot“: Grenze 6 h, Gegenfälle, Lesefehler und die zwei Verdrahtungen (laeufe-aufraeumen, Wachen-Dossier) als echte Prozesse.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { alarmZeile, bestandRotAlarm, bestandRotText } from './bestand-rot-alarm.mjs'

const JETZT = Date.parse('2026-10-23T12:00:00Z')
const lauf = (conclusion, createdAt, status = 'completed') => ({ status, conclusion, createdAt })
const alarm = (laeufe) => bestandRotAlarm(laeufe, JETZT)

// Grüner Lauf vor 5 h, danach ein roter: kein Alarm.
assert.equal(alarm([lauf('success', '2026-10-23T07:00:00Z'), lauf('failure', '2026-10-23T10:00:00Z')]).alarm, false)
// Grüner Lauf vor 8 h, rot vor 7 h: Alarm, Stunden = Alter des grünen Laufs.
const rot8 = alarm([lauf('success', '2026-10-23T04:00:00Z'), lauf('failure', '2026-10-23T05:00:00Z')])
assert.equal(rot8.alarm, true)
assert.equal(rot8.stunden, 8)
assert.equal(rot8.rote, 1)
// Nur rote seit 7 h, kein grüner Lauf in der Liste: Alarm.
const nurRot = alarm([lauf('failure', '2026-10-23T05:00:00Z'), lauf('failure', '2026-10-23T08:00:00Z')])
assert.equal(nurRot.alarm, true)
assert.equal(nurRot.stunden, 7)
assert.equal(nurRot.rote, 2)
// Grenze: genau 6 h kein Alarm, eine Sekunde mehr Alarm.
assert.equal(alarm([lauf('success', '2026-10-23T06:00:00Z'), lauf('failure', '2026-10-23T07:00:00Z')]).alarm, false)
assert.equal(alarm([lauf('success', '2026-10-23T05:59:59Z'), lauf('failure', '2026-10-23T07:00:00Z')]).alarm, true)
// Roter Lauf nur vor dem grünen, übersprungene und laufende danach, leere Liste: kein Alarm.
assert.equal(alarm([lauf('failure', '2026-10-22T00:00:00Z'), lauf('success', '2026-10-22T01:00:00Z')]).alarm, false)
assert.equal(alarm([lauf('success', '2026-10-22T01:00:00Z'), lauf('skipped', '2026-10-23T01:00:00Z'), lauf(null, '2026-10-23T02:00:00Z', 'in_progress')]).alarm, false)
assert.equal(alarm([]).alarm, false)
// Abgebrochene und Zeitüberschreitung zählen als rot; ein einziger Lauf genügt.
assert.equal(alarm([lauf('success', '2026-10-22T01:00:00Z'), lauf('cancelled', '2026-10-22T02:00:00Z')]).alarm, true)
assert.equal(alarm([lauf('success', '2026-10-22T01:00:00Z'), lauf('timed_out', '2026-10-22T02:00:00Z')]).alarm, true)
// Der jüngste grüne Lauf zählt, nicht der erste der Liste (Reihenfolge egal).
const zwei = alarm([lauf('success', '2026-10-23T10:00:00Z'), lauf('failure', '2026-10-22T10:00:00Z'), lauf('success', '2026-10-21T10:00:00Z')])
assert.equal(zwei.alarm, false)
assert.equal(zwei.gruenAm, '2026-10-23T10:00:00Z')
// Wiederkehr: nach Erholung wieder rot, Alarm erst jenseits der Grenze ab dem neuen grünen Lauf.
assert.equal(alarm([lauf('success', '2026-10-23T03:00:00Z'), lauf('failure', '2026-10-23T04:00:00Z'), lauf('success', '2026-10-22T03:00:00Z')]).alarm, true)

// Zeile: Stunden mit einer Nachkommastelle, ohne Alarm keine Zeile.
assert.equal(
  alarmZeile(rot8),
  'ALARM Bestandsbau seit 8.0 h rot (letzter grüner Lauf 2026-10-23T04:00:00Z, 1 rote/abgebrochene danach, Grenze 6 h)',
)
assert.match(alarmZeile(nurRot), /^ALARM Bestandsbau seit 7\.0 h rot \(kein grüner Lauf in den abgefragten Läufen, 2 rote/)
assert.equal(alarmZeile(alarm([])), undefined)

// Leser: richtiger gh-Aufruf, Alarm/Entwarnung als Text, Lesefehler und kaputtes JSON sind selbst eine Zeile.
const aufrufe = []
const ghMit = (antwort) => (...a) => {
  aufrufe.push(a)
  return antwort
}
const ROT_JSON = JSON.stringify([lauf('success', '2026-10-23T04:00:00Z'), lauf('failure', '2026-10-23T05:00:00Z')])
assert.match(bestandRotText(ghMit(ROT_JSON), 'o/r', JETZT), /^ALARM Bestandsbau seit 8\.0 h rot/)
assert.deepEqual(aufrufe[0].slice(0, 6), ['run', 'list', '--repo', 'o/r', '--workflow', 'bestand-bauen.yml'])
const GRUEN_JSON = JSON.stringify([lauf('success', '2026-10-23T11:00:00Z'), lauf('failure', '2026-10-23T05:00:00Z')])
assert.match(bestandRotText(ghMit(GRUEN_JSON), 'o/r', JETZT), /^Bestandsbau: kein Alarm \(letzter grüner Lauf 2026-10-23T11:00:00Z, 0 /)
const wirft = () => {
  throw new Error('gh kaputt\nzweite Zeile')
}
assert.equal(bestandRotText(wirft, 'o/r', JETZT), 'ALARM? Läufe des Bestandsbaus nicht lesbar: gh kaputt')
assert.match(bestandRotText(ghMit('kein json'), 'o/r', JETZT), /^ALARM\? Läufe des Bestandsbaus nicht lesbar/)

// Verdrahtung als Prozess: `gh` über die Kulisse, damit der echte Aufrufer läuft (Datum 2026-10-18 weit in der Vergangenheit, 2999 in der Zukunft).
const stub = (laeufe) =>
  `data:text/javascript,import cp from "node:child_process";import{syncBuiltinESMExports}from "node:module";cp.execFileSync=()=>${JSON.stringify(JSON.stringify(laeufe))};syncBuiltinESMExports();globalThis.fetch=async()=>new Response("{}",{status:500})`
const ALT = [lauf('success', '2026-10-18T01:00:00Z'), lauf('failure', '2026-10-18T02:00:00Z')]
const FRISCH = [lauf('success', '2999-12-31T01:00:00Z'), lauf('failure', '2026-10-18T02:00:00Z')]
const aufraeumen = fileURLToPath(new URL('./laeufe-aufraeumen.mjs', import.meta.url))
const fahre = (laeufe) => spawnSync(process.execPath, ['--import', stub(laeufe), aufraeumen, '--trocken'], { encoding: 'utf8', env: { ...process.env, LAUF_TOKEN: '' } })
const a1 = fahre(ALT)
assert.equal(a1.status, 0, a1.stderr)
assert.match(a1.stdout, /^ALARM Bestandsbau seit [\d.]+ h rot \(letzter grüner Lauf 2026-10-18T01:00:00Z, 1 rote/m)
assert.doesNotMatch(fahre(FRISCH).stdout, /ALARM/)

// Dossier der Wache: Datei 12 trägt dieselbe Zeile (cwd = Wegwerfordner, die übrigen Quellen melden ihre Fehler selbst).
const dossier = fileURLToPath(new URL('./wache-urteil-dossier.mjs', import.meta.url))
const wegwerf = mkdtempSync(join(tmpdir(), 'bestand-rot-'))
try {
  const code = `const {sammle}=await import(${JSON.stringify(pathToFileURL(dossier).href)});const d=sammle().find(([n])=>n==="12-bestandsbau-alarm.txt");console.log(d?d[1]:"FEHLT")`
  const d1 = spawnSync(process.execPath, ['--import', stub(ALT), '--input-type=module', '-e', code], { encoding: 'utf8', cwd: wegwerf })
  assert.match(d1.stdout, /^ALARM Bestandsbau seit [\d.]+ h rot/m, d1.stderr)
  const d2 = spawnSync(process.execPath, ['--import', stub(FRISCH), '--input-type=module', '-e', code], { encoding: 'utf8', cwd: wegwerf })
  assert.match(d2.stdout, /^Bestandsbau: kein Alarm/m, d2.stderr)
} finally {
  rmSync(wegwerf, { recursive: true, force: true })
}
console.log('bestand-rot-alarm: ok (Grenze 6 h, 4 Gegenfälle, Lesefehler, aufraeumen + Dossier als Prozess)')
