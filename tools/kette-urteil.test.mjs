/**
 * Test zu `tools/kette-urteil.mjs`: Ergebnislisten, Abbruch des eigenen Laufs (Attrappe) und echter Prozess (Exit-Code und Ergebniszeile).
 * Aufruf: node tools/kette-urteil.test.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { ABBRUCH_FRIST_MS, abbruchZiel, abgebrochenBeenden, kettenLauf, kettenUrteil, laufAbbrechen } from './kette-urteil.mjs'

const liste = (...r) => Object.fromEntries(r.map((result, i) => [`job${i}`, { result }]))

assert.equal(kettenUrteil(liste('success', 'success', 'success')), 'gruen')
assert.equal(kettenUrteil(liste('success')), 'gruen')
assert.equal(kettenUrteil(liste('cancelled', 'cancelled', 'cancelled')), 'abgebrochen')
assert.equal(kettenUrteil(liste('cancelled')), 'abgebrochen')
assert.equal(kettenUrteil(liste('failure', 'success', 'success')), 'rot')
assert.equal(kettenUrteil(liste('success', 'success', 'failure')), 'rot')
assert.equal(kettenUrteil(liste('failure', 'failure')), 'rot')
// Mix: ein Teiljob fehlt (Messung 25.10.2026: 1 von 15 abgebrochenen Läufen)
assert.equal(kettenUrteil(liste('success', 'cancelled', 'success')), 'rot')
assert.equal(kettenUrteil(liste('cancelled', 'success')), 'rot')
assert.equal(kettenUrteil(liste('cancelled', 'cancelled', 'failure')), 'rot')
assert.equal(kettenUrteil(liste('success', 'skipped')), 'rot')
assert.equal(kettenUrteil(liste('skipped', 'skipped')), 'rot')
assert.equal(kettenUrteil(liste('cancelled', 'skipped')), 'rot')
assert.equal(kettenUrteil({}), 'rot')
assert.equal(kettenUrteil(undefined), 'rot')
assert.equal(kettenUrteil({ a: {} }), 'rot')
assert.equal(kettenUrteil({ a: null }), 'rot')

// Mod-Schnellweg (20.11.2026): benannte Jobs, `scope.outputs.nur_mod` entscheidet, was „übersprungen“ bedeutet
const jobs = (nurMod, ergebnisse) => ({
  scope: { result: ergebnisse.scope ?? 'success', outputs: nurMod === undefined ? {} : { nur_mod: nurMod } },
  logik: { result: ergebnisse.logik ?? 'success' },
  bau: { result: ergebnisse.bau ?? 'success' },
  modschnell: { result: ergebnisse.modschnell ?? 'skipped' },
})
const UEB = { logik: 'skipped', bau: 'skipped', modschnell: 'success' }
assert.equal(kettenUrteil(jobs('0', {})), 'gruen', 'volle Kette, Schnellweg übersprungen')
assert.equal(kettenUrteil(jobs('1', UEB)), 'gruen', 'nur Mod: Teiljobs übersprungen, Schnellweg success')
assert.equal(kettenUrteil(jobs('1', { ...UEB, modschnell: 'failure' })), 'rot', 'nur Mod: Schnellweg rot')
assert.equal(kettenUrteil(jobs('1', { ...UEB, modschnell: 'skipped' })), 'rot', 'nur Mod: Schnellweg übersprungen = nichts geprüft')
assert.equal(kettenUrteil(jobs('1', { ...UEB, modschnell: 'cancelled' })), 'abgebrochen', 'nur Mod: Schnellweg abgebrochen')
assert.equal(kettenUrteil(jobs('1', { ...UEB, logik: 'failure' })), 'rot', 'nur Mod: ein Teiljob trotzdem rot')
assert.equal(kettenUrteil(jobs('1', { ...UEB, scope: 'failure' })), 'rot', 'nur Mod: Umfangsjob rot')
assert.equal(kettenUrteil(jobs('1', { ...UEB, scope: 'skipped' })), 'rot', 'nur Mod: Umfangsjob übersprungen')
assert.equal(kettenUrteil(jobs('0', { logik: 'skipped' })), 'rot', 'volle Kette: übersprungener Teiljob ist rot')
assert.equal(kettenUrteil(jobs(undefined, { logik: 'skipped', bau: 'skipped' })), 'rot', 'fehlendes nur_mod: übersprungen ist rot')
assert.equal(kettenUrteil(jobs('', { logik: 'skipped' })), 'rot', 'leeres nur_mod: übersprungen ist rot')
assert.equal(kettenUrteil(jobs('true', { logik: 'skipped' })), 'rot', 'nur_mod nur genau 1')
assert.equal(kettenUrteil(jobs('0', { modschnell: 'success' })), 'gruen', 'Schnellweg läuft nie ohne nur_mod; success schadet nicht')
assert.equal(kettenUrteil(jobs('0', { modschnell: 'failure' })), 'rot', 'Schnellweg rot zählt immer')
assert.equal(kettenUrteil(jobs('0', { logik: 'cancelled', bau: 'cancelled' })), 'abgebrochen', 'Neustart: Umfangsjob fertig, Rest abgebrochen')
assert.equal(kettenUrteil(jobs('0', { logik: 'cancelled', bau: 'success' })), 'rot', 'Mix bleibt rot')
assert.equal(kettenUrteil(jobs('0', { scope: 'cancelled', logik: 'cancelled', bau: 'cancelled' })), 'abgebrochen', 'alles abgebrochen')
assert.equal(kettenUrteil(jobs('0', { scope: 'failure', logik: 'cancelled', bau: 'cancelled' })), 'rot', 'Umfangsjob rot, Rest abgebrochen')
assert.equal(kettenUrteil({ scope: { result: 'success', outputs: { nur_mod: '1' } } }), 'rot', 'nur Mod ohne Schnellweg in needs')

const ZIEL = 'repos/eigner/repo/actions/runs/4711/force-cancel'
// Abbruch des eigenen Laufs: Attrappe prüft Befehl und Argumente
const aufrufe = []
assert.equal(laufAbbrechen(ZIEL, (cmd, args) => { aufrufe.push([cmd, ...args]) }), true)
assert.deepEqual(aufrufe, [['gh', 'api', '-X', 'POST', ZIEL]])
assert.equal(laufAbbrechen(ZIEL, () => { throw new Error('409') }), false, 'Fehler beim Abbruch')
const unberuehrt = []
assert.equal(laufAbbrechen(undefined, (...a) => { unberuehrt.push(a) }), false, 'ohne Lauf-Nummer')
assert.equal(laufAbbrechen('', (...a) => { unberuehrt.push(a) }), false, 'leere Lauf-Nummer')
assert.deepEqual(unberuehrt, [], 'ohne Lauf-Nummer kein Aufruf')

let gewartet = 0
const warte = async () => { gewartet++ }
assert.equal(await abgebrochenBeenden(ZIEL, () => {}, warte), 1, 'überlebt der Schritt den Abbruch: rot')
assert.equal(gewartet, 1, 'nach gelungenem Abbruch wird auf das Ende gewartet')
assert.equal(await abgebrochenBeenden(ZIEL, () => { throw new Error('x') }, warte), 1, 'Abbruch scheitert: rot')
assert.equal(await abgebrochenBeenden(undefined, () => {}, warte), 1, 'ohne Lauf-Nummer: rot')
assert.equal(gewartet, 1, 'ohne gelungenen Abbruch keine Wartezeit')

// Verdrahtung: alles abgebrochen mit Lauf-Nummer ruft `gh run cancel <Nummer>` und wartet; grün und rot rufen nichts
const zeilen = []
const calls = []
const nurAufruf = (cmd, args) => { calls.push([cmd, ...args]) }
const mitId = { NEEDS: JSON.stringify(liste('cancelled', 'cancelled')), GITHUB_RUN_ID: '4711', GITHUB_REPOSITORY: 'eigner/repo' }
gewartet = 0
assert.equal(await kettenLauf(mitId, (z) => zeilen.push(z), nurAufruf, warte), 1)
assert.deepEqual(calls, [['gh', 'api', '-X', 'POST', 'repos/eigner/repo/actions/runs/4711/force-cancel']])
assert.equal(gewartet, 1)
assert.ok(zeilen.includes('kette-urteil: abgebrochen'))
assert.ok(zeilen.includes('job1: cancelled'))
calls.length = 0
assert.equal(await kettenLauf({ NEEDS: JSON.stringify(liste('success')), GITHUB_RUN_ID: '4711', GITHUB_REPOSITORY: 'eigner/repo' }, () => {}, nurAufruf, warte), 0)
assert.equal(await kettenLauf({ NEEDS: JSON.stringify(liste('success', 'failure')), GITHUB_RUN_ID: '4711', GITHUB_REPOSITORY: 'eigner/repo' }, () => {}, nurAufruf, warte), 1)
assert.equal(await kettenLauf({ NEEDS: JSON.stringify(liste('success', 'cancelled')), GITHUB_RUN_ID: '4711', GITHUB_REPOSITORY: 'eigner/repo' }, () => {}, nurAufruf, warte), 1)
assert.deepEqual(calls, [], 'grün, rot und Mix brechen den Lauf nie ab')
assert.equal(gewartet, 1)
assert.equal(ABBRUCH_FRIST_MS, 120_000)
assert.equal(abbruchZiel({ GITHUB_REPOSITORY: 'eigner/repo', GITHUB_RUN_ID: '4711' }), ZIEL)
assert.equal(abbruchZiel({ GITHUB_RUN_ID: '4711' }), '', 'ohne Repo')
assert.equal(abbruchZiel({ GITHUB_REPOSITORY: 'eigner/repo' }), '', 'ohne Lauf-Nummer')
calls.length = 0
assert.equal(await kettenLauf({ NEEDS: JSON.stringify(liste('cancelled')), GITHUB_RUN_ID: '4711' }, () => {}, nurAufruf, warte), 1, 'ohne Repo rot')
assert.deepEqual(calls, [], 'ohne Repo kein Aufruf')

const SKRIPT = resolve(import.meta.dirname, 'kette-urteil.mjs')
function lauf(needs) {
  const env = { ...process.env }
  delete env.GITHUB_RUN_ID
  delete env.NEEDS
  if (needs !== undefined) env.NEEDS = JSON.stringify(needs)
  const r = spawnSync(process.execPath, [SKRIPT], { env, encoding: 'utf8', windowsHide: true })
  return { code: r.status, aus: r.stdout }
}
const gruen = lauf(liste('success', 'success'))
assert.equal(gruen.code, 0)
assert.match(gruen.aus, /^kette-urteil: gruen$/m)
// Ohne Lauf-Nummer kann der Lauf sich nicht abbrechen: Exit 1, nie 0 (0 zählte als success)
const abgebrochen = lauf(liste('cancelled', 'cancelled'))
assert.equal(abgebrochen.code, 1)
assert.match(abgebrochen.aus, /^kette-urteil: abgebrochen$/m)
assert.match(abgebrochen.aus, /^job0: cancelled$/m)
const rot = lauf(liste('success', 'failure'))
assert.equal(rot.code, 1)
assert.match(rot.aus, /^kette-urteil: rot$/m)
assert.equal(lauf(liste('success', 'cancelled')).code, 1)
assert.equal(lauf(undefined).code, 1, 'ohne NEEDS rot')

// Prozess mit Nur-Mod-Eingabe: Exit 0 nur mit grünem Schnellweg
const nurModGruen = lauf(jobs('1', UEB))
assert.equal(nurModGruen.code, 0)
assert.match(nurModGruen.aus, /^kette-urteil: gruen$/m)
assert.equal(lauf(jobs('1', { ...UEB, modschnell: 'skipped' })).code, 1, 'Prozess: Schnellweg übersprungen rot')

console.log('kette-urteil.test: Listenfälle, Schnellweg-Fälle, Abbruchfälle und Prozessfälle ok')
