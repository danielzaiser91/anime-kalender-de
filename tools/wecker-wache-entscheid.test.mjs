/**
 * Prüft die Wecker-Wache: Ein roter Start zählt nicht als erledigt (einmal nachholen je Fenster), jeder Workflow des Weckplans steht in der Wache,
 * und der Workflow ruft die Entscheidung wirklich auf. Aufruf: `node tools/wecker-wache-entscheid.test.mjs`
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { entscheide, MAX_STARTS_OHNE_ERFOLG, ROT_WARTEN_H } from './wecker-wache-entscheid.mjs'

const lies = (pfad) => readFileSync(new URL(`../${pfad}`, import.meta.url), 'utf8')
const JETZT = Date.parse('2026-10-16T12:00:00Z')
const vor = (h, conclusion, status = 'completed') => ({ createdAt: new Date(JETZT - h * 3600e3).toISOString(), conclusion, status })
const ja = (laeufe, frist = 30, ohne = false) => entscheide(laeufe, JETZT, frist, ohne).nachholen

/* ---- Grundverhalten bleibt ---- */
assert.equal(ja([]), true, 'nie gestartet -> starten')
assert.equal(ja([vor(5, 'success'), vor(29, 'success')]), false, 'erfolgreich und rechtzeitig')
assert.equal(ja([vor(31, 'success')]), true, 'Erfolg älter als die Frist')
assert.equal(ja([vor(31, null, 'in_progress'), vor(60, 'success')]), false, 'läuft gerade (auch ein alter Start)')
assert.equal(ja([vor(1, null, 'queued'), vor(40, 'failure')]), false, 'wartender Lauf sperrt das Nachholen')

/* ---- Der Fall vom 16.10.2026: einziger Lauf rot, nie ein Erfolg ---- */
assert.equal(ja([vor(15, 'failure')]), true, 'roter Start vor 15 h, kein Erfolg -> nachholen (vorher erst nach 30 h)')
assert.equal(ja([vor(ROT_WARTEN_H - 1, 'failure')]), false, 'frisch rot: erst nach der Wartezeit')
assert.equal(ja([vor(ROT_WARTEN_H + 1, 'failure')]), true)
assert.equal(ja([vor(9, 'timed_out'), vor(33, 'success')]), true, 'auch Zeitüberschreitung ist nicht erledigt')

/* ---- Erfolg innerhalb der Frist: Tageslauf ist erledigt, auch wenn der letzte Start rot war ---- */
assert.equal(ja([vor(10, 'failure'), vor(20, 'success')]), false, 'Erfolg vor 20 h, Frist 30 h -> kein Nachholen')
assert.equal(ja([vor(10, 'failure'), vor(31, 'success')]), true, 'Erfolg älter als die Frist, roter Start vor 10 h')

/* ---- Keine Endlosschleife: höchstens ein Nachholversuch je Fenster ---- */
assert.equal(MAX_STARTS_OHNE_ERFOLG, 2)
assert.equal(ja([vor(8, 'failure'), vor(20, 'failure')]), false, 'Original und Nachhol-Start beide rot -> nicht noch einmal')
assert.equal(ja([vor(8, 'failure'), vor(20, 'failure'), vor(32, 'failure'), vor(60, 'success')]), false, 'dauerhaft rot bleibt still bis zur Frist des letzten Starts')
assert.equal(ja([vor(8, 'failure'), vor(20, 'failure'), vor(60, 'success')]), false)
assert.equal(ja([vor(31, 'failure'), vor(50, 'failure')]), true, 'nach der vollen Frist wird wieder gestartet (wie bisher)')

/* ---- Abgebrochen: nur bei ohne-abbruch ein Nicht-Start ---- */
const abbruch = [vor(5, 'cancelled'), vor(40, 'success')]
assert.equal(ja(abbruch, 30, false), false, 'abgebrochener Start zählt als Start (wie bisher)')
assert.equal(ja(abbruch, 30, true), true, 'mit ohne-abbruch zählt er nicht')
assert.equal(ja([vor(5, 'cancelled'), vor(12, 'failure')], 30, true), true, 'ohne-abbruch: der rote Start davor entscheidet')

/* ---- Verdrahtung: Wache kennt jeden Workflow des Weckplans und ruft die Entscheidung auf ---- */
const wache = parse(lies('.github/workflows/wecker-wache.yml'))
const schritte = wache.jobs.wache.steps
const nachholen = schritte.find((s) => s.id === 'nachholen')
assert.match(nachholen.run, /node tools\/wecker-wache-entscheid\.mjs "\$max"/)
const plan = nachholen.run.match(/PLAN="([^"]+)"/)[1].split(' ').map((e) => e.split(':')[0])
const weckplan = [...lies('shared/weckplan.ts').matchAll(/\{ workflow: '([^']+)'/g)].map((m) => m[1])
assert.ok(weckplan.length >= 12)
for (const w of weckplan) assert.ok(plan.includes(w), `${w} steht im Weckplan, fehlt aber in der Wecker-Wache`)
for (const w of plan) assert.ok(weckplan.includes(w), `${w} steht in der Wecker-Wache, fehlt aber im Weckplan`)
/* Handlauf um 12 Uhr + Wecker um 03 Uhr des Folgetags = 15 h: der Mindestabstand darf den Wecker-Start nicht sperren (16.10.2026 fehlte er so). */
const mk = lies('shared/weckplan.ts').match(/workflow: 'meldungskopie\.yml', stunden: \[3\], abstandMin: (\d+)/)
assert.ok(mk && Number(mk[1]) < 15 * 60, `Mindestabstand meldungskopie.yml ${mk?.[1]} min muss unter 15 h liegen`)
const checkout =schritte.findIndex((s) => s.uses?.startsWith('actions/checkout'))
assert.ok(checkout >= 0 && checkout < schritte.indexOf(nachholen), 'Checkout liegt vor dem Schritt, der das Skript ruft')
assert.match(schritte[checkout].with['sparse-checkout'], /tools\/wecker-wache-entscheid\.mjs/)
assert.match(schritte[checkout].with['sparse-checkout'], /tools\/lauf-melden\.sh/)

console.log('wecker-wache-entscheid: ok')
