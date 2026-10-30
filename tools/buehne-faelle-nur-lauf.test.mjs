/**
 * Prozesstest zu `buehne-faelle.mjs --nur <slug>` im Erfolgspfad (Wegwerf-Wurzel unter `os.tmpdir()` mit Kopien des Werkzeugs
 * und kleinen erfundenen Daten, kein echter Bestand): Ein manipulierter Fremdfall bleibt nach `--nur` byteweise stehen, der
 * gewählte Fall folgt den neuen Daten. Rechnet der `--nur`-Zweig doch alles neu, ist der Fremdfall wieder der alte (rot).
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { FAELLE, FERNSEHTAG } from './buehne-faelle.mjs'

const REPO = resolve(import.meta.dirname, '..')
// Alle Fälle samt Kennungen kommen aus dem Werkzeug; Avatar mit negativer Kennung steht nicht im Katalog.
const ALLE_FAELLE = [...FAELLE, ...FERNSEHTAG]
const KENNUNGEN = ALLE_FAELLE.map((f) => f.titel).filter((id) => id > 0)

function baueWurzel(wurzel, name86) {
  for (const d of ['tools/buehne-faelle.mjs', 'tools/buehne-faelle-nur.mjs', 'pipeline/lib/ausgabe-kennung.ts', 'pipeline/bau/ohne-synchro-namen.ts']) {
    mkdirSync(dirname(join(wurzel, d)), { recursive: true })
    copyFileSync(join(REPO, d), join(wurzel, d))
  }
  mkdirSync(join(wurzel, 'data'), { recursive: true })
  writeFileSync(join(wurzel, 'data/kennungen.json'), JSON.stringify({ titel: KENNUNGEN.map((al, i) => [1000 + i, al, 5000 + i]) }))
  const titel = KENNUNGEN.map((id) => ({ id, franchiseId: id, titleRomaji: id === 131586 ? name86 : `Titel ${id}` }))
  const daten = join(wurzel, 'public/data')
  mkdirSync(daten, { recursive: true })
  const dateien = { 'titles-core.json': titel, 'titles.json': titel, 'releases.json': [], 'events.json': [], 'franchises.json': {}, 'news.json': [], 'synonyme.json': {}, 'meta.json': { stand: 'fest' } }
  for (const [n, inhalt] of Object.entries(dateien)) writeFileSync(join(daten, n), JSON.stringify(inhalt))
}

function lauf(wurzel, ...args) {
  return execFileSync(process.execPath, [join(wurzel, 'tools/buehne-faelle.mjs'), ...args], { stdio: 'pipe', windowsHide: true }).toString()
}

const wurzel = mkdtempSync(join(tmpdir(), 'buehne-nur-lauf-'))
try {
  const ziel = join(wurzel, 'faelle.json')
  baueWurzel(wurzel, 'Alt')
  lauf(wurzel, '--ziel', ziel)
  const voll = JSON.parse(readFileSync(ziel, 'utf8'))
  assert.equal(Object.keys(voll.faelle).length, ALLE_FAELLE.length, 'ohne Option entstehen alle Fälle')
  assert.ok(ALLE_FAELLE.length >= 18, 'Fall-Liste nicht leer gelesen')

  // Fremdfall manipulieren; der gewählte Fall bekommt neue Daten.
  voll.faelle['one-piece'].name = 'MANIPULIERT'
  writeFileSync(ziel, `${JSON.stringify(voll)}\n`)
  baueWurzel(wurzel, 'Neu')
  const manipuliert = readFileSync(ziel, 'utf8')
  const ausgabe = lauf(wurzel, '--nur', '86', '--ziel', ziel)
  assert.doesNotMatch(ausgabe, /one-piece/, 'gemeldet wird nur der gewählte Fall')

  const nachher = JSON.parse(readFileSync(ziel, 'utf8'))
  const vorher = JSON.parse(manipuliert)
  assert.equal(nachher.faelle['one-piece'].name, 'MANIPULIERT', 'Fremdfall bleibt manipuliert')
  for (const slug of Object.keys(vorher.faelle).filter((s) => s !== '86')) assert.equal(JSON.stringify(nachher.faelle[slug]), JSON.stringify(vorher.faelle[slug]), slug)
  assert.equal(JSON.stringify([nachher.heute, nachher.meta]), JSON.stringify([vorher.heute, vorher.meta]))
  assert.deepEqual(Object.keys(nachher.faelle), Object.keys(vorher.faelle))
  assert.equal(nachher.faelle['86']['titles.json'][0].titleRomaji, 'Neu', 'der gewählte Fall folgt den neuen Daten')
  assert.equal(vorher.faelle['86']['titles.json'][0].titleRomaji, 'Alt')

  // --ziel auf eine fehlende Datei: klare Meldung, Exit 1, keine Datei entsteht.
  const fehlt = join(wurzel, 'gibt-es-nicht.json')
  let fehler
  try {
    lauf(wurzel, '--nur', '86', '--ziel', fehlt)
  } catch (e) {
    fehler = e
  }
  assert.equal(fehler?.status, 1)
  assert.match(String(fehler.stderr), /--nur braucht eine vorhandene faelle\.json/)
  assert.doesNotMatch(String(fehler.stderr), /\n\s+at /, 'kein Stack')
} finally {
  rmSync(wurzel, { recursive: true, force: true })
}
console.log('buehne-faelle --nur Lauf: 3 Gruppen, Wurzel aus Fall-Liste (Fremdfall bleibt, gewählter Fall neu, fehlende Zieldatei) ok')
