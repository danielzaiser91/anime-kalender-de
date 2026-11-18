/**
 * Alarm „Nachtprüfung rot“ (`nachtAlarmZeile`, `nachtText` in tools/bestand-rot-alarm.mjs, 18.11.2026): Die Nachtprüfung (nacht-pruefung.yml) ist das Netz unter den aus der PR-Kette
 * verschobenen Prüfungen. Dieser Test bleibt in der PR-Kette (anders als tools/bestand-rot-alarm.test.mjs, das nachts läuft). Fälle: Grenze 26 h genau und eine Sekunde mehr,
 * jede `conclusion`, nie gelaufen, Reihenfolge der Eingabe, Lesefehler, der richtige gh-Aufruf, die Zeile in `rotAlarmText` und der echte Aufrufer `laeufe-aufraeumen.mjs --trocken` als Prozess.
 * Aufruf: node tools/nacht-alarm.test.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { nachtAlarmZeile, nachtText, rotAlarmText } from './bestand-rot-alarm.mjs'

const JETZT = Date.parse('2026-11-19T12:00:00Z')
const lauf = (conclusion, createdAt, status = 'completed', headSha = 'ffffffffffffffffffffffffffffffffffffffff') => ({ status, conclusion, createdAt, databaseId: 77, headSha })
const vor = (stunden, sekunden = 0) => new Date(JETZT - stunden * 3_600_000 - sekunden * 1000).toISOString()
const zeile = (laeufe) => nachtAlarmZeile(laeufe, JETZT)

// Nie gelaufen: Alarm mit Handlungshinweis.
assert.match(zeile([]), /^ALARM Nachtprüfung noch nie gelaufen \(nacht-pruefung\.yml starten, Wecker prüfen\)$/)
// Grün: kein Alarm, bis genau 26 h; eine Sekunde mehr ist Alarm („nicht gestartet“, Stunden mit einer Nachkommastelle).
assert.equal(zeile([lauf('success', vor(11))]), undefined)
assert.equal(zeile([lauf('success', vor(26))]), undefined, 'genau 26 h sind noch kein Alarm')
assert.match(zeile([lauf('success', vor(26, 1))]), /^ALARM Nachtprüfung seit 26\.0 h nicht gestartet \(letzter Start .*, Grenze 26 h\)$/)
assert.match(zeile([lauf('success', vor(50))]), /^ALARM Nachtprüfung seit 50\.0 h nicht gestartet/)
// Rot: jeder rote Ausgang des neuesten fertigen Laufs; Zeile nennt den Lauf und die Zahl der roten seit dem letzten grünen.
for (const c of ['failure', 'timed_out', 'cancelled']) assert.match(zeile([lauf(c, vor(3))]), /^ALARM Nachtprüfung rot \(neuester Lauf .*, 1 rote\/abgebrochene seit dem letzten grünen; Commits \?\.\.fffffff auf main, git log \?\.\.fffffff; Log: gh run view 77\)$/, c)
for (const c of ['success', 'skipped', 'neutral']) assert.equal(zeile([lauf(c, vor(3))]), undefined, `${c} ist kein Alarm`)
// Nur der neueste fertige Lauf zählt: grün nach rot entwarnt, rot nach grün alarmiert, laufende und übersprungene Läufe davor ändern es nicht.
assert.equal(zeile([lauf('failure', vor(30)), lauf('success', vor(5))]), undefined)
assert.match(zeile([lauf('success', vor(30)), lauf('failure', vor(5))]), /1 rote\/abgebrochene seit dem letzten grünen/)
assert.match(zeile([lauf('success', vor(40)), lauf('failure', vor(30)), lauf('failure', vor(5))]), /2 rote\/abgebrochene seit dem letzten grünen/)
assert.equal(zeile([lauf('success', vor(30)), lauf(null, vor(1), 'in_progress')]), undefined, 'ein laufender neuer Lauf ist frisch genug')
assert.match(zeile([lauf('failure', vor(5)), lauf(null, vor(1), 'in_progress')]), /^ALARM Nachtprüfung rot/, 'ein laufender Lauf entwarnt einen roten nicht')
// Verursacher: die Zeile nennt den Commit-Bereich vom letzten grünen zum roten Kopf (beide Kurzhashes, sieben Zeichen).
const GRUEN = 'aaaaaaa1111111111111111111111111111111aa'
const ROT = 'bbbbbbb2222222222222222222222222222222bb'
const bereich = zeile([lauf('success', vor(30), 'completed', GRUEN), lauf('failure', vor(5), 'completed', ROT)])
assert.match(bereich, /Commits aaaaaaa\.\.bbbbbbb auf main, git log aaaaaaa\.\.bbbbbbb;/)
assert.doesNotMatch(bereich, /aaaaaaa1/, 'nur sieben Zeichen')
// Mehrere rote nach dem letzten grünen: der neueste rote Kopf, der jüngste grüne Lauf.
const mehrere = zeile([lauf('success', vor(50), 'completed', 'cccccccdddd'), lauf('success', vor(40), 'completed', GRUEN), lauf('failure', vor(30), 'completed', 'eeeeeeeffff'), lauf('failure', vor(5), 'completed', ROT)])
assert.match(mehrere, /Commits aaaaaaa\.\.bbbbbbb auf main/)
// Ohne grünen Lauf in der Liste: Fragezeichen statt erfundenem Anfang.
assert.match(zeile([lauf('failure', vor(5), 'completed', ROT)]), /Commits \?\.\.bbbbbbb auf main/)
// Reihenfolge der Eingabe ist egal (gh liefert neueste zuerst, der Test auch umgekehrt).
assert.equal(zeile([lauf('success', vor(5)), lauf('failure', vor(30))]), undefined)
assert.match(zeile([lauf('failure', vor(5)), lauf('success', vor(30))]), /^ALARM Nachtprüfung rot/)

// Leser: richtiger gh-Aufruf, Lesefehler und kaputtes JSON sind selbst eine Zeile.
const aufrufe = []
const ghMit = (antwort) => (...a) => {
  aufrufe.push(a)
  if (antwort instanceof Error) throw antwort
  return antwort
}
assert.equal(nachtText(ghMit(JSON.stringify([lauf('success', vor(3))])), 'o/r', JETZT), 'Nachtprüfung: kein Alarm')
assert.deepEqual(aufrufe[0].slice(0, 6), ['run', 'list', '--repo', 'o/r', '--workflow', 'nacht-pruefung.yml'])
assert.ok(aufrufe[0].some((a) => /(^|,)headSha(,|$)/.test(a)), 'gh fragt headSha mit ab')
assert.match(nachtText(ghMit(JSON.stringify([lauf('failure', vor(3))])), 'o/r', JETZT), /^ALARM Nachtprüfung rot/)
assert.equal(nachtText(ghMit(new Error('gh weg\nzweite Zeile')), 'o/r', JETZT), 'ALARM? Läufe der Nachtprüfung nicht lesbar: gh weg')
assert.match(nachtText(ghMit('kein json'), 'o/r', JETZT), /^ALARM\? Läufe der Nachtprüfung nicht lesbar: /)

// Verdrahtung in rotAlarmText: die Nachtzeile steht nach der Deploy-Zeile; nur die Nachtprüfung ist rot, Bestandsbau und Deploy sind grün.
const ghNachtRot = (...a) => JSON.stringify(a.includes('nacht-pruefung.yml') ? [lauf('failure', vor(3))] : [lauf('success', vor(3))])
const zeilen = rotAlarmText(ghNachtRot, 'o/r', JETZT).split('\n')
assert.equal(zeilen.at(-2), 'Deploy: kein Alarm')
assert.match(zeilen.at(-1), /^ALARM Nachtprüfung rot/)
assert.ok(!zeilen.slice(0, -1).some((z) => z.startsWith('ALARM ')), 'Bestandsbau und Deploy melden keinen Alarm')
const ghAlleGruen = (...a) => JSON.stringify([lauf('success', vor(3))])
assert.equal(rotAlarmText(ghAlleGruen, 'o/r', JETZT).split('\n').at(-1), 'Nachtprüfung: kein Alarm')
// Ein Lesefehler der Nachtprüfung lässt die anderen Zeilen stehen.
const ghNachtKaputt = (...a) => {
  if (a.includes('nacht-pruefung.yml')) throw new Error('nacht kaputt')
  return JSON.stringify([lauf('success', vor(3))])
}
const kaputt = rotAlarmText(ghNachtKaputt, 'o/r', JETZT).split('\n')
assert.equal(kaputt.at(-1), 'ALARM? Läufe der Nachtprüfung nicht lesbar: nacht kaputt')
assert.equal(kaputt.at(-2), 'Deploy: kein Alarm')

// Der echte Aufrufer als Prozess: laeufe-aufraeumen --trocken druckt die Zeile (gh als Kulisse; Datum 2999 liegt in der Zukunft, ist also nie „nicht gestartet“).
const stub = (laeufe) =>
  `data:text/javascript,import cp from "node:child_process";import{syncBuiltinESMExports}from "node:module";cp.execFileSync=()=>${JSON.stringify(JSON.stringify(laeufe))};syncBuiltinESMExports();globalThis.fetch=async()=>new Response("{}",{status:500})`
const wegwerf = mkdtempSync(join(tmpdir(), 'nacht-alarm-'))
try {
  const aufraeumen = fileURLToPath(new URL('./laeufe-aufraeumen.mjs', import.meta.url))
  const gesundheit = join(wegwerf, 'g.json')
  writeFileSync(gesundheit, '{}')
  const synchro = join(wegwerf, 'synchro')
  mkdirSync(synchro)
  writeFileSync(join(synchro, 'katalog.json'), '{"serien":[]}')
  writeFileSync(join(synchro, 'releases.json'), '[]')
  const fahre = (laeufe) =>
    spawnSync(process.execPath, ['--import', stub(laeufe), aufraeumen, '--trocken', '--gesundheit', gesundheit], {
      encoding: 'utf8',
      timeout: 120_000,
      windowsHide: true,
      env: { ...process.env, LAUF_TOKEN: '', AK_SYNCHRO_QUELLE: synchro },
    })
  const rot = fahre([lauf('failure', '2999-12-31T01:00:00Z')])
  assert.match(rot.stdout, /^ALARM Nachtprüfung rot \(neuester Lauf 2999-12-31T01:00:00Z/m, rot.stdout + rot.stderr)
  const gruen = fahre([lauf('success', '2999-12-31T01:00:00Z')])
  assert.match(gruen.stdout, /^WACHE ruhig: 6 Prüfungen ohne Alarm \(.*Nachtprüfung/m, gruen.stdout + gruen.stderr)
  assert.doesNotMatch(gruen.stdout, /ALARM Nachtprüfung/)
} finally {
  rmSync(wegwerf, { recursive: true, force: true })
}
console.log('nacht-alarm: ok (nie gelaufen, Grenze 26 h, rot/grün/laufend, Reihenfolge, Lesefehler, gh-Aufruf, rotAlarmText, laeufe-aufraeumen als Prozess)')
