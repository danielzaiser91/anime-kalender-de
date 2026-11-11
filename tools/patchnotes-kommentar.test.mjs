/**
 * Test zu `patchnotes-kommentar.mjs`: Ein Kommentar mit Zeile „Patch Notes: …“ ersetzt die Beschreibung in der Patch-Notes-Prüfung.
 * Die Verdrahtung läuft über `ausEreignis` mit echtem Merge-Commit in einem Wegwerf-Repo (unter `os.tmpdir()` bzw. dem ersten Argument)
 * und einer Attrappe für `gh api`. Beschreibungstext wörtlich aus PR 3211 (Falschtreffer „der nächste Bau zeigt sie“).
 * Aufruf: `node tools/patchnotes-kommentar.test.mjs [Wurzelordner]`
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bewerte, ausEreignis } from './check-patchnotes-pflicht.mjs'
import { beschreibungMitKommentaren, wirksameBeschreibung } from './patchnotes-kommentar.mjs'

const WURZEL = process.argv[2] ?? tmpdir()
const ZEILE = 'Patch Notes: keine – Werkzeug, 0 Titel/Termine/Meldungen/Wege/Zeilen.'
const FALSCHTREFFER = `Wirkung\nDie Zahl der betroffenen Titel misst der nächste Bau, der nächste Bau zeigt sie.\n${ZEILE}`
const k = (body, login = 'autor', assoc = 'NONE') => ({ body, user: { login }, author_association: assoc })

// Reine Auswahl
assert.equal(wirksameBeschreibung('B', [], 'autor'), 'B', 'ohne Kommentar gilt die Beschreibung')
assert.equal(wirksameBeschreibung('B', [k('nur Text')], 'autor'), 'B', 'Kommentar ohne Zeile ändert nichts')
assert.equal(wirksameBeschreibung('B', [k('Nachtrag\nPatch Notes: keine – Umbau')], 'autor'), 'Patch Notes: keine – Umbau')
assert.equal(wirksameBeschreibung('B', [k('Patch Notes: keine – Umbau'), k('Patch Notes: vertagt – Bau')], 'autor'), 'Patch Notes: vertagt – Bau', 'neuester gewinnt')
assert.equal(wirksameBeschreibung('B', [k('Patch Notes: keine – Umbau', 'fremd')], 'autor'), 'B', 'Fremder ohne Rechte zählt nicht')
assert.equal(wirksameBeschreibung('B', [k('Patch Notes: keine – Umbau', 'inhaber', 'OWNER')], 'autor'), 'Patch Notes: keine – Umbau', 'Berechtigter zählt')
assert.equal(wirksameBeschreibung('B', [k('Patch Notes: keine – Umbau'), k('Patch Notes: vertagt – Bau', 'fremd')], 'autor'), 'Patch Notes: keine – Umbau', 'neuerer Fremder verdrängt nicht')
assert.equal(wirksameBeschreibung('B', [k('Ich schreibe Patch Notes: keine – x mitten im Satz')], 'autor'), 'B', 'Zeilenanfang nötig')

// Urteil: Falschtreffer mit und ohne Kommentar, Vertagung, altes Verhalten
const dateien = ['pipeline/x.ts']
const urteil = (beschreibung) => bewerte({ dateien, neu: [], beschreibung })
assert.equal(urteil(FALSCHTREFFER).ok, false, 'Vorbedingung: ohne Kommentar trifft die Textsuche')
assert.equal(urteil(wirksameBeschreibung(FALSCHTREFFER, [k('Patch Notes: keine – Umbau/intern, Messung nennt nur den Bau')], 'autor')).ok, true, 'Kommentar rettet den Falschtreffer')
assert.equal(urteil(wirksameBeschreibung(FALSCHTREFFER, [k('Patch Notes: vertagt – wirkt nach dem Bau')], 'autor')).ok, false, 'vertagt ohne Vorrat bleibt rot')
assert.equal(urteil(wirksameBeschreibung(FALSCHTREFFER, [k('kein Zeile hier')], 'autor')).ok, false, 'kein Patch-Notes-Kommentar: altes Verhalten')

// Verdrahtung: echter Merge-Commit, Ereignisdatei, API-Attrappe
const ordner = mkdtempSync(join(WURZEL, 'pn-kommentar-'))
const git = (...a) => execFileSync('git', ['-c', 'core.autocrlf=false', '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: ordner, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 }).trim()
function datei(pfad, inhalt) {
  mkdirSync(join(ordner, pfad, '..'), { recursive: true })
  writeFileSync(join(ordner, pfad), inhalt)
  git('add', '-A')
  git('commit', '-q', '-m', pfad)
}
try {
  git('init', '-q', '-b', 'main')
  datei('a.txt', 'a')
  git('checkout', '-q', '-b', 'zweig')
  datei('pipeline/x.ts', 'x')
  git('checkout', '-q', 'main')
  datei('b.txt', 'b')
  git('merge', '-q', '--no-ff', '-m', 'merge', 'zweig')
  const ereignis = join(ordner, 'ereignis.json')
  writeFileSync(ereignis, JSON.stringify({ pull_request: { number: 7, body: FALSCHTREFFER, title: 't', user: { login: 'autor' }, head: { ref: 'korrektur/x' } } }))
  process.env.GITHUB_EVENT_PATH = ereignis
  process.env.GITHUB_REPOSITORY = 'o/r'
  const aufrufe = []
  const api = (kommentare) => (args) => {
    aufrufe.push(args.join(' '))
    return [kommentare]
  }
  const mit = (kommentare) => bewerte(ausEreignis(git, api(kommentare)))
  assert.equal(mit([]).ok, false, 'Verdrahtung: ohne Kommentar rot')
  assert.equal(mit([k('Patch Notes: keine – Umbau/intern, Messung nennt nur den Bau')]).ok, true, 'Verdrahtung: Kommentar macht grün')
  assert.ok(aufrufe.every((a) => a.includes('repos/o/r/issues/7/comments')), `Aufrufadresse: ${aufrufe[0]}`)
  const kaputt = () => {
    throw new Error('gh: 403')
  }
  assert.equal(bewerte(ausEreignis(git, kaputt)).ok, false, 'Abruffehler: es gilt die Beschreibung')
  assert.equal(beschreibungMitKommentaren({ body: 'B', number: 1, user: { login: 'a' } }, '', kaputt), 'B', 'ohne Repo kein Abruf')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
console.log('  ✓ Patchnotes-Kommentar: 8 Auswahl-, 4 Urteils-, 5 Verdrahtungsfälle')
