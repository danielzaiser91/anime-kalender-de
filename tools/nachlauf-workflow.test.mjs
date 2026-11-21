/**
 * Test zu .github/workflows/nachlauf.yml (PR 4417, 21.11.2026): Auslöser, Rechte, Gruppe ohne Abbruch, kein verschluckbares Rot,
 * und jede `paths-ignore`-Ausnahme stammt aus `BOT_DATEIEN_OHNE_LESER` (sonst bliebe ein gelesener Pfad ungeprüft).
 * Dazu `nachlaufAlarmZeile` (tools/bestand-rot-alarm.mjs): Rot nennt den Commit-Bereich, Abgebrochenes und Grün melden nichts.
 * Aufruf: node tools/nachlauf-workflow.test.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { nachlaufAlarmZeile, nachlaufText, rotAlarmText } from './bestand-rot-alarm.mjs'
import { BOT_DATEIEN_OHNE_LESER } from './pr-nachrechnen-bot-pfade.mjs'

const wf = parse(readFileSync(join(import.meta.dirname, '../.github/workflows/nachlauf.yml'), 'utf8'))

assert.deepEqual(Object.keys(wf.on), ['push', 'workflow_dispatch'])
assert.deepEqual(wf.on.push.branches, ['main'])
assert.deepEqual(wf.permissions, { contents: 'read' }, 'nur lesen: der Nachlauf meldet, er schreibt nichts')
assert.equal(wf.concurrency.group, 'nachlauf')
assert.equal(wf.concurrency['cancel-in-progress'], false)
for (const eintrag of wf.on.push['paths-ignore']) {
  const pfad = eintrag.replace(/\/\*\*$/, '')
  assert.ok(BOT_DATEIEN_OHNE_LESER.includes(pfad), `${eintrag}: nicht in BOT_DATEIEN_OHNE_LESER`)
}
for (const [name, job] of Object.entries(wf.jobs)) {
  assert.equal(job.if, undefined, `${name}: kein if (ein übersprungener Job zählte grün)`)
  assert.equal(job['continue-on-error'], undefined, `${name}: Rot darf nicht verschluckt werden`)
  for (const s of job.steps) assert.ok(s['continue-on-error'] === undefined && (s.run === undefined || s.if === undefined), `${name}: Schritt mit if/continue-on-error`)
}
const befehle = [...wf.jobs.kern.strategy.matrix.include.map((m) => m.befehl), ...wf.jobs.budget.steps.map((s) => s.run).filter(Boolean)]
assert.deepEqual(befehle, ['npm run check:logic-1', 'npm run check:logic-2', 'npm run check:tests-1', 'npm run check:tests-2', 'npm run build', 'npm run check:lighthouse'])

const lauf = (conclusion, createdAt, headSha, databaseId = 5) => ({ status: 'completed', conclusion, createdAt, headSha, databaseId })
const gruen = lauf('success', '2026-11-21T01:00:00Z', 'aaaaaaa1111111111111111111111111111111111')
const rot = lauf('failure', '2026-11-21T03:00:00Z', 'bbbbbbb2222222222222222222222222222222222', 9)
assert.equal(nachlaufAlarmZeile([]), undefined)
assert.equal(nachlaufAlarmZeile([gruen]), undefined)
const zeile = nachlaufAlarmZeile([gruen, rot])
assert.match(zeile, /^ALARM Nachlauf auf main rot \(neuester Lauf 2026-11-21T03:00:00Z, 1 rote\/abgebrochene seit dem letzten grünen; Commits aaaaaaa\.\.bbbbbbb, git log aaaaaaa\.\.bbbbbbb; Log: gh run view 9\)$/)
assert.equal(nachlaufAlarmZeile([rot, { ...gruen, createdAt: '2026-11-21T04:00:00Z' }]), undefined, 'grün nach rot entwarnt')
assert.equal(nachlaufAlarmZeile([gruen, lauf('cancelled', '2026-11-21T03:00:00Z', 'd')]), undefined, 'von Hand abgebrochen ist kein Alarm')
assert.equal(nachlaufAlarmZeile([gruen, { status: 'in_progress', conclusion: '', createdAt: '2026-11-21T05:00:00Z' }]), undefined)
assert.match(nachlaufAlarmZeile([lauf('timed_out', '2026-11-21T03:00:00Z', 'eeeeeee4')]), /^ALARM Nachlauf auf main rot .*Commits \?\.\.eeeeeee,/, 'ohne grünen Lauf: Anfang unbekannt')

// Verdrahtung: workflow nachlauf.yml wird gelistet, Lesefehler ist selbst eine Zeile, die Zeile steht zuletzt in rotAlarmText.
assert.equal(nachlaufText(() => JSON.stringify([gruen]), 'o/r'), 'Nachlauf: kein Alarm')
assert.match(nachlaufText(() => JSON.stringify([gruen, rot]), 'o/r'), /^ALARM Nachlauf auf main rot/)
assert.equal(nachlaufText(() => { throw new Error('gh weg\nzweite') }, 'o/r'), 'ALARM? Läufe des Nachlaufs nicht lesbar: gh weg')
const aufrufe = []
const gh = (...a) => (aufrufe.push(a[a.indexOf('--workflow') + 1]), JSON.stringify(a.includes('nachlauf.yml') ? [gruen, rot] : [{ ...gruen, createdAt: '2026-11-21T03:30:00Z' }]))
assert.match(rotAlarmText(gh, 'o/r', Date.parse('2026-11-21T04:00:00Z')).split('\n').at(-1), /^ALARM Nachlauf auf main rot/)
assert.ok(aufrufe.includes('nachlauf.yml'))
console.log('nachlauf-workflow.test: ok')
