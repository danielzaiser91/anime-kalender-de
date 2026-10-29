/** Test der Abzeichen-Messung (`ansicht-abzeichen.mjs`): eingefrorener Probetitel auch bei leerem Datenstand, fehlende Daten sind rot. Aufruf: node tools/ansicht-abzeichen.test.mjs */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { meldeAbzeichen, mitProbetitel, PROBE_NAME } from './ansicht-abzeichen.mjs'

const istProbe = (t) => t.titleDe === PROBE_NAME && t.os === true && t.ankuendigung?.synchro === 'angekuendigt' && !t.westlich

const leer = mitProbetitel([])
assert.equal(leer.length, 1, 'leerer Datenstand: genau der Probetitel')
assert.ok(istProbe(leer[0]))

const echt = { id: 5, slug: 'x', titleDe: 'Echt', tr: 3, westlich: true, streams: [{ platform: 'netflix' }], ankuendigung: { synchro: 'offen' } }
const mit = mitProbetitel([echt])
assert.equal(mit.length, 2)
assert.deepEqual(mit[0], echt, 'echte Titel bleiben unverändert')
assert.ok(istProbe(mit[1]), 'Probetitel gilt auch, wenn die Vorlage westlich ist und eine offene Ankündigung trägt')
assert.equal(mit[1].tr, undefined, 'kein Rang der Vorlage')
assert.deepEqual(mit[1].streams, [], 'kein Weg der Vorlage (sonst hätte er belegte Synchro)')
assert.notEqual(mit[1].id, echt.id)

/* Fehlende Daten: rot, ohne dass ein Browser startet. */
const ordner = mkdtempSync(path.join(tmpdir(), 'abzeichen-'))
const chromium = { launch: () => assert.fail('Browser darf nicht starten') }
const rot = await meldeAbzeichen({ chromium, antworte: () => {}, dist: ordner, lesePixel: () => {} })
rmSync(ordner, { recursive: true, force: true })
assert.equal(rot, true, 'dist ohne titles.json: rot')
console.log('ansicht-abzeichen: ok (Probetitel bei leerem und gefülltem Datenstand, Vorlage westlich/offen/mit Weg, fehlendes titles.json rot)')
