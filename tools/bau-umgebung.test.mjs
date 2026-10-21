/**
 * Prüfungen laufen unter `check:logic` und `check:bestand-liste` ohne die Variablen des Bestandsbaus (tools/bau-umgebung.mjs),
 * auch in ihren Unterprozessen; fremde Variablen bleiben. Gegenprobe zu PR 1624: eine Prüfung, die `DATEN_WARNUNG` roh erbt, wäre rot.
 * Aufruf: node tools/bau-umgebung.test.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { BAU_VARIABLEN, ohneBauVariablen } from './bau-umgebung.mjs'

const WURZEL = resolve(import.meta.dirname, '..')
const ordner = mkdtempSync(join(tmpdir(), 'bau-umgebung-'))
const posix = (p) => p.replace(/\\/g, '/')
// Fest eingetragen statt aus dem Modul gelesen: sonst wäre die geprüfte Liste ihr eigenes Orakel (Prüfer 1647).
const ERWARTET = ['BAU_BEGINN', 'BAU_LAUF', 'DATEN_WARNUNG', 'LAUF_SCHRITTE', 'LAUF_TOKEN', 'LAUF_ZIEL', 'LAUF_ZWECK', 'MELDER', 'MELDUNGEN_SICHERN']

/** Prüfung und ihr Kindprozess melden Exit 1, sobald eine Bau-Variable dasitzt oder die fremde Variable fehlt. */
function schreibeListe() {
  const namen = JSON.stringify(ERWARTET)
  const pruefung = `const gesetzt = ${namen}.filter((n) => n in process.env)
if (gesetzt.length) { console.error('Bau-Variablen: ' + gesetzt.join(',')); process.exit(1) }
if (process.env.FREMDE_VARIABLE !== 'bleibt') { console.error('fremde Variable fehlt'); process.exit(1) }
`
  const kind = join(ordner, 'a-kind.mjs')
  writeFileSync(kind, pruefung)
  const eltern = join(ordner, 'b-eltern.mjs')
  writeFileSync(eltern, `import { spawnSync } from 'node:child_process'
const r = spawnSync(process.execPath, ['${posix(kind)}'], { stdio: 'inherit', env: { ...process.env } })
process.exit(r.status ?? 1)
`)
  const liste = join(ordner, 'liste.txt')
  writeFileSync(liste, `${posix(kind)}\n${posix(eltern)}\n`)
  return liste
}

function lauf(liste, name, bauVariablen) {
  const env = { ...process.env, FREMDE_VARIABLE: 'bleibt', BESTAND_AUSNAHMEN: join(ordner, 'keine.json') }
  for (const n of ERWARTET) delete env[n]
  Object.assign(env, bauVariablen)
  const r = spawnSync(process.execPath, [join(WURZEL, 'tools/check-logic-alle.mjs'), liste, name], { cwd: WURZEL, encoding: 'utf8', env })
  return { status: r.status, text: `${r.stdout}\n${r.stderr}` }
}

try {
  assert.deepEqual([...BAU_VARIABLEN].sort(), ERWARTET, 'Liste der Bau-Variablen wie erwartet')
  const alle = Object.fromEntries(ERWARTET.map((n) => [n, '1']))
  const liste = schreibeListe()
  for (const name of ['check:logic', 'check:bestand-liste']) {
    const gesetzt = lauf(liste, name, alle)
    assert.equal(gesetzt.status, 0, `${name}: mit allen Bau-Variablen grün: ${gesetzt.text.slice(-400)}`)
    const eine = lauf(liste, name, { DATEN_WARNUNG: 'Meldungen zurückgestellt: 1' })
    assert.equal(eine.status, 0, `${name}: allein DATEN_WARNUNG grün: ${eine.text.slice(-400)}`)
  }

  const kopie = ohneBauVariablen({ DATEN_WARNUNG: 'x', LAUF_TOKEN: 'y', ANDERE: 'z' })
  assert.deepEqual(kopie, { ANDERE: 'z' }, 'nur Bau-Variablen fallen weg')
  const vorlage = { DATEN_WARNUNG: 'x' }
  ohneBauVariablen(vorlage)
  assert.equal(vorlage.DATEN_WARNUNG, 'x', 'das Original bleibt unverändert')
  assert.deepEqual(ohneBauVariablen({}), {}, 'leere Umgebung bleibt leer')
  assert.ok(BAU_VARIABLEN.includes('DATEN_WARNUNG') && BAU_VARIABLEN.length === new Set(BAU_VARIABLEN).size, 'DATEN_WARNUNG steht genau einmal in der Liste')
  console.log(`bau-umgebung: ${BAU_VARIABLEN.length} Variablen, 2 Läufe (check:logic, check:bestand-liste) ohne Bau-Variablen in Prüfung und Kind: ok`)
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
