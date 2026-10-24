// Alarm „Bestandsbau rot“: Grenze 6 h, Gegenfälle, Lesefehler und die zwei Verdrahtungen (laeufe-aufraeumen, Wachen-Dossier) als echte Prozesse.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { alarmZeile, bestandRotAlarm, bestandRotText, deployAlarmZeile, fehlerschritte, rotAlarmText, roteSeitGruen, schritteAlarmZeile } from './bestand-rot-alarm.mjs'

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
// Ein alter, nie beendeter Lauf ist keine Bezugszeit: ohne grünen Lauf zählt der älteste beendete (hier 1 h alt).
assert.equal(alarm([lauf('', '2026-10-22T00:00:00Z', 'in_progress'), lauf('failure', '2026-10-23T11:00:00Z')]).alarm, false)
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

// Deploy: gleiche Grenze, eigene Zeile; Zahlenpaare verschieden (8 h alt, 1 rot).
assert.equal(deployAlarmZeile([lauf('success', '2026-10-23T07:00:00Z'), lauf('failure', '2026-10-23T10:00:00Z')], JETZT), undefined)
assert.equal(deployAlarmZeile([lauf('success', '2026-10-23T06:00:00Z'), lauf('failure', '2026-10-23T07:00:00Z')], JETZT), undefined)
assert.equal(deployAlarmZeile([], JETZT), undefined)
assert.equal(
  deployAlarmZeile([lauf('success', '2026-10-23T04:00:00Z'), lauf('cancelled', '2026-10-23T05:00:00Z')], JETZT),
  'ALARM Deploy seit 8.0 h ohne Erfolg (letzter Erfolg 2026-10-23T04:00:00Z, 1 rote/abgebrochene danach, Grenze 6 h)',
)
assert.match(deployAlarmZeile([lauf('failure', '2026-10-23T05:00:00Z')], JETZT), /kein Erfolg in den abgefragten Läufen/)

// Fehlerschritte: verschiedene Namen über Läufe und Jobs, Doppelte zählen einmal, Nicht-Fehlschläge nicht.
const job = (name, ...schritte) => ({ name, steps: schritte.map(([n, c]) => ({ name: n, conclusion: c })) })
assert.deepEqual(
  fehlerschritte([
    { jobs: [job('build', ['Bau', 'failure'], ['Setup', 'success'])] },
    { jobs: [job('build', ['Bau', 'failure']), job('pruefen', ['Test', 'failure'], ['Rest', 'cancelled'])] },
    {},
  ]),
  ['build: Bau', 'pruefen: Test'],
)
assert.deepEqual(fehlerschritte([]), [])
const rot1 = { databaseId: 1, createdAt: '2026-10-23T09:00:00Z' }
const rotZwei = { databaseId: 2, createdAt: '2026-10-23T09:30:00Z' }
const zwei2 = ['a: x', 'b: y']
assert.equal(schritteAlarmZeile([], zwei2, JETZT), undefined)
assert.equal(schritteAlarmZeile([rot1], ['a: x'], JETZT), undefined)
assert.equal(schritteAlarmZeile([rot1], [], JETZT), undefined)
// Grenze 1 h: genau 1 h kein Alarm, eine Sekunde mehr Alarm.
assert.equal(schritteAlarmZeile([{ databaseId: 3, createdAt: '2026-10-23T11:00:00Z' }], zwei2, JETZT), undefined)
assert.match(schritteAlarmZeile([{ databaseId: 3, createdAt: '2026-10-23T10:59:59Z' }], zwei2, JETZT), /^ALARM Bestandsbau seit 1\.0 h rot mit 2 /)
// Der älteste rote Lauf (letztes Element, neueste zuerst) gibt den Beginn an.
assert.equal(
  schritteAlarmZeile([rotZwei, rot1], ['a: x', 'b: y', 'c: z'], JETZT),
  'ALARM Bestandsbau seit 3.0 h rot mit 3 verschiedenen Fehlerschritten (a: x; b: y; c: z; Grenze 1 h)',
)
const seit = roteSeitGruen([
  lauf('success', '2026-10-23T01:00:00Z'),
  { ...lauf('failure', '2026-10-23T04:00:00Z'), databaseId: 7 },
  { ...lauf('failure', '2026-10-23T09:00:00Z'), databaseId: 8 },
  { ...lauf('failure', '2026-10-22T09:00:00Z'), databaseId: 9 },
])
assert.deepEqual(seit.map((r) => r.databaseId), [8, 7])

// Gesamttext mit Kulisse: Läufe nach Workflow getrennt, Jobs nach Lauf-ID; drei Läufe, der richtige in der Mitte.
const kulisse = ({ bestand, deploy, jobs }) => (...a) => {
  if (a[1] === 'list') return a[a.indexOf('--workflow') + 1] === 'deploy.yml' ? deploy : bestand
  if (a[1] === 'view' && a[2] === '7') return jobs.sieben
  if (a[1] === 'view' && a[2] === '8') return jobs.acht
  throw new Error(`unerwartet ${a.join(' ')}`)
}
const BESTAND = JSON.stringify([
  { ...lauf('success', '2026-10-23T01:00:00Z'), databaseId: 6 },
  { ...lauf('failure', '2026-10-23T04:00:00Z'), databaseId: 7 },
  { ...lauf('failure', '2026-10-23T09:00:00Z'), databaseId: 8 },
])
const DEPLOY_ROT = JSON.stringify([lauf('success', '2026-10-23T01:00:00Z'), lauf('failure', '2026-10-23T05:00:00Z')])
const JOBS = { sieben: JSON.stringify({ jobs: [job('build', ['Bau', 'failure'])] }), acht: JSON.stringify({ jobs: [job('pruefen', ['Test', 'failure'])] }) }
const voll = rotAlarmText(kulisse({ bestand: BESTAND, deploy: DEPLOY_ROT, jobs: JOBS }), 'o/r', JETZT).split('\n')
assert.equal(voll.length, 3)
assert.match(voll[0], /^ALARM Bestandsbau seit 11\.0 h rot/)
assert.equal(voll[1], 'ALARM Bestandsbau seit 8.0 h rot mit 2 verschiedenen Fehlerschritten (build: Bau; pruefen: Test; Grenze 1 h)')
assert.match(voll[2], /^ALARM Deploy seit 11\.0 h ohne Erfolg/)
// Gleicher Schritt in beiden Läufen: nur die 6-h-Zeile; Deploy grün: Entwarnungszeile.
const DEPLOY_GRUEN = JSON.stringify([lauf('success', '2026-10-23T11:00:00Z')])
const eins = rotAlarmText(kulisse({ bestand: BESTAND, deploy: DEPLOY_GRUEN, jobs: { sieben: JOBS.sieben, acht: JOBS.sieben } }), 'o/r', JETZT).split('\n')
assert.equal(eins.length, 2)
assert.equal(eins[1], 'Deploy: kein Alarm')
// Lesefehler je Teil.
const deployWirft = (...a) => {
  if (a.includes('deploy.yml')) throw new Error('deploy kaputt\nzweite')
  return kulisse({ bestand: BESTAND, deploy: '[]', jobs: JOBS })(...a)
}
assert.match(rotAlarmText(deployWirft, 'o/r', JETZT), /\nALARM\? Läufe des Deploys nicht lesbar: deploy kaputt$/)
const jobsWirft = (...a) => {
  if (a[2] === '8') throw new Error('jobs kaputt')
  return kulisse({ bestand: BESTAND, deploy: '[]', jobs: JOBS })(...a)
}
assert.match(rotAlarmText(jobsWirft, 'o/r', JETZT), /\nALARM\? Fehlerschritte des Bestandsbaus nicht lesbar: jobs kaputt\n/)

// Verdrahtung als Prozess: `gh` über die Kulisse, damit der echte Aufrufer läuft (Datum 2026-10-18 weit in der Vergangenheit, 2999 in der Zukunft).
const stub = (laeufe) =>
  `data:text/javascript,import cp from "node:child_process";import{syncBuiltinESMExports}from "node:module";cp.execFileSync=(c,a)=>{if(a.includes("--workflow")&&(a[a.indexOf("--repo")+1]!=="danielzaiser91/anime-kalender-de"||!["bestand-bauen.yml","deploy.yml"].includes(a[a.indexOf("--workflow")+1])))throw new Error("gh?");return ${JSON.stringify(JSON.stringify(laeufe))}};syncBuiltinESMExports();globalThis.fetch=async()=>new Response("{}",{status:500})`
const ALT = [lauf('success', '2026-10-18T01:00:00Z'), lauf('failure', '2026-10-18T02:00:00Z')]
const FRISCH = [lauf('success', '2999-12-31T01:00:00Z'), lauf('failure', '2026-10-18T02:00:00Z')]
const aufraeumen = fileURLToPath(new URL('./laeufe-aufraeumen.mjs', import.meta.url))
const fahre = (laeufe) => spawnSync(process.execPath, ['--import', stub(laeufe), aufraeumen, '--trocken'], { encoding: 'utf8', env: { ...process.env, LAUF_TOKEN: '' } })
const a1 = fahre(ALT)
assert.equal(a1.status, 0, a1.stderr)
assert.match(a1.stdout, /^ALARM Bestandsbau seit [\d.]+ h rot \(letzter grüner Lauf 2026-10-18T01:00:00Z, 1 rote/m)
assert.match(a1.stdout, /^ALARM Deploy seit [0-9.]+ h ohne Erfolg/m)
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
console.log('bestand-rot-alarm: ok (Grenze 6 h, 4 Gegenfälle, Deploy, Fehlerschritte, Lesefehler, aufraeumen + Dossier als Prozess)')
