/** Test der Messung der Karte „Termin offen“ (`ansicht-termin-karte.mjs`, Regeln in `termin-karte-urteil.mjs`). Aufruf: node tools/ansicht-termin-karte.test.mjs */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { meldeTerminKarte, mitProbetitel, PROBE_ID } from './ansicht-termin-karte.mjs'
import { lageFehler, pixelFehler } from './termin-karte-urteil.mjs'

/* Probetitel: auch bei leerem Datenstand; echte Titel bleiben unverändert; kein Rang, kein westlich, genau der Weg der Ankündigung. */
const leer = mitProbetitel([])
assert.equal(leer.length, 1)
assert.equal(leer[0].id, PROBE_ID)
assert.equal(leer[0].ankuendigung.synchro, 'angekuendigt')
const echt = { id: 5, slug: 'x', tr: 3, westlich: true, streams: [{ platform: 'netflix' }], ankuendigung: { synchro: 'offen' } }
const voll = mitProbetitel([echt])
assert.deepEqual(voll[0], echt)
assert.equal(voll[1].tr, undefined)
assert.equal(voll[1].westlich, undefined)
assert.deepEqual(voll[1].streams.map((s) => s.platform), ['crunchyroll'])

/* Lage: Grundfall grün, dann jede Regel einzeln rot. */
const lage = { karte: { l: 16, r: 344, t: 300, b: 520 }, kasten: { l: 16, r: 344, t: 100, b: 288 }, breite: 360, knoepfe: { Knopf: 44, Quelle: 44 } }
assert.deepEqual(lageFehler(lage), [])
assert.equal(lageFehler({ ...lage, karte: { ...lage.karte, l: 20 } }).length, 1, 'nicht bündig links')
assert.equal(lageFehler({ ...lage, karte: { ...lage.karte, r: 350 } }).length, 1, 'nicht bündig rechts')
assert.equal(lageFehler({ ...lage, kasten: { ...lage.kasten, l: 0, r: 400 }, karte: { ...lage.karte, l: 0, r: 400 } }).length, 1, 'ragt aus dem Fenster')
assert.equal(lageFehler({ ...lage, karte: { ...lage.karte, t: 295 } }).length, 1, '7 px Abstand: rot')
assert.deepEqual(lageFehler({ ...lage, karte: { ...lage.karte, t: 296 } }), [], '8 px Abstand: grün')
assert.equal(lageFehler({ ...lage, knoepfe: { Knopf: 43, Quelle: 44 } }).length, 1, 'Knopf 43 px: rot')
assert.equal(lageFehler({ ...lage, knoepfe: { Knopf: 44, Quelle: 0 } }).length, 1, 'Quelle fehlt (Höhe 0): rot')

/* Pixel: runde Ecken zeigen den Grund; Rand hebt sich ab; darunter nur Grund. */
const grund = [10, 10, 10]
const gut = { ecken: [grund, grund, grund, grund], rand: [60, 60, 70], grund, darunter: grund }
assert.deepEqual(pixelFehler(gut), [])
assert.equal(pixelFehler({ ...gut, ecken: [[60, 60, 70], grund, grund, grund] }).length, 1, 'Ecke oben links eckig')
assert.equal(pixelFehler({ ...gut, ecken: [grund, grund, [60, 60, 70], grund] }).length, 1, 'Ecke unten rechts eckig')
assert.equal(pixelFehler({ ...gut, rand: [12, 12, 12] }).length, 1, 'kein Rand sichtbar')
assert.equal(pixelFehler({ ...gut, darunter: [60, 60, 70] }).length, 1, 'etwas unter der Karte')

/* Fehlende Daten: rot, ohne dass ein Browser startet. */
const ordner = mkdtempSync(path.join(tmpdir(), 'termin-karte-'))
const chromium = { launch: () => assert.fail('Browser darf nicht starten') }
const rot = await meldeTerminKarte({ chromium, antworte: () => {}, dist: ordner, lesePixel: () => {} })
rmSync(ordner, { recursive: true, force: true })
assert.equal(rot, true, 'dist ohne titles.json: rot')
console.log('ansicht-termin-karte: ok (Probetitel, Lage-Grenzen 7/8 px und 43/44 px, Ecken, Rand, Zeile darunter, fehlendes titles.json rot)')
