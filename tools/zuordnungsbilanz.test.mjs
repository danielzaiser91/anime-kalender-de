/**
 * Prüft tools/zuordnungsbilanz.mjs mit zwei synthetischen Kopien (Wegwerf-Ordner): neu, umgezogen, verloren, gleich,
 * Mehrstaffel-Adresse, Adresse nur in einem Stand, Prozesslauf samt Exit-Code.
 * Aufruf: node tools/zuordnungsbilanz.test.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { formatiere, klasseVon, leseZuordnung, summen, vergleiche } from './zuordnungsbilanz.mjs'

const ordner = mkdtempSync(join(tmpdir(), 'zuordnungsbilanz-test-'))
const SKRIPT = join(fileURLToPath(import.meta.url), '..', 'zuordnungsbilanz.mjs')

/** Kopie mit den drei Quellen; Zeilen: [tabelle, plattform, url, titel_id]. */
function baueKopie(name, zeilen) {
  const pfad = join(ordner, name)
  const db = new DatabaseSync(pfad)
  db.exec(`CREATE TABLE pruefung (plattform TEXT, url TEXT, titel_id INTEGER);
    CREATE TABLE prime_folge (plattform TEXT, url TEXT, titel_id INTEGER);
    CREATE TABLE titel_zeile (plattform TEXT, url TEXT);
    CREATE VIEW pruefung_titel AS SELECT plattform, url, NULL AS titel_id FROM titel_zeile WHERE 0;`)
  for (const [t, p, u, id] of zeilen) db.prepare(`INSERT INTO ${t} VALUES (?, ?, ?)`).run(p, u, id)
  db.close()
  return pfad
}

try {
  const alt = baueKopie('alt.sqlite', [
    ['pruefung', 'netflix', 'n/gleich', 11],
    ['pruefung', 'netflix', 'n/neu', null],
    ['pruefung', 'netflix', 'n/umgezogen', 21],
    ['pruefung', 'netflix', 'n/verloren', 31],
    ['prime_folge', null, 'p/staffeln', 41],
    ['prime_folge', null, 'p/staffeln', 42],
    ['pruefung', 'netflix', 'n/nur-alt', 51],
  ])
  const neu = baueKopie('neu.sqlite', [
    ['pruefung', 'netflix', 'n/gleich', 11],
    ['pruefung', 'netflix', 'n/neu', 61],
    ['pruefung', 'netflix', 'n/umgezogen', 22],
    ['pruefung', 'netflix', 'n/verloren', null],
    ['prime_folge', null, 'p/staffeln', 42],
    ['prime_folge', null, 'p/staffeln', 43],
    ['pruefung', 'netflix', 'n/nur-neu', 71],
  ])

  const z = vergleiche(leseZuordnung(alt), leseZuordnung(neu))
  const klasse = Object.fromEntries(z.map((r) => [r.adresse.split(' ')[1], r.klasse]))
  assert.deepEqual(klasse, {
    'n/gleich': 'gleich',
    'n/neu': 'neu',
    'n/nur-alt': 'verloren',
    'n/nur-neu': 'neu',
    'n/umgezogen': 'umgezogen',
    'n/verloren': 'verloren',
    'p/staffeln': 'umgezogen',
  })
  assert.deepEqual(summen(z), { neu: 2, umgezogen: 2, verloren: 2, gleich: 1 })
  assert.equal(z.find((r) => r.adresse === 'prime p/staffeln').alt.join(), '41,42', 'Plattform ohne Angabe = prime, Menge sortiert')

  // Klassen einzeln, auch die Randfälle leer/leer und umgekehrte Reihenfolge der Argumente
  assert.equal(klasseVon([], []), 'gleich')
  assert.equal(klasseVon([], [1]), 'neu')
  assert.equal(klasseVon([1], []), 'verloren')
  assert.equal(klasseVon([1], [2]), 'umgezogen')
  assert.equal(klasseVon([1], [1, 2]), 'umgezogen')

  const text = formatiere(z)
  assert.match(text.split('\n')[0], /^Zuordnungsbilanz: 7 Adressen — neu 2, umgezogen 2, verloren 2, gleich 1$/)
  assert.ok(!text.includes('n/gleich'), 'gleich druckt ohne --gleich nicht')
  assert.ok(formatiere(z, true).includes('n/gleich'))
  assert.match(text, /umgezogen 21 -> 22 {2}netflix n\/umgezogen/)
  assert.match(text, /verloren {2}31 -> - {2}netflix n\/verloren/)

  const lauf = spawnSync(process.execPath, ['--no-warnings', SKRIPT, alt, neu, '--gleich'], { encoding: 'utf8', windowsHide: true })
  assert.equal(lauf.status, 0, lauf.stderr)
  assert.match(lauf.stdout, /^Zuordnungsbilanz: 7 Adressen/)
  assert.match(lauf.stdout, /gleich {4}11 -> 11 {2}netflix n\/gleich/)
  const fehl = spawnSync(process.execPath, ['--no-warnings', SKRIPT, join(ordner, 'fehlt.sqlite'), neu], { encoding: 'utf8', windowsHide: true })
  assert.equal(fehl.status, 2)
  console.log('zuordnungsbilanz.test: 7 Adressen in 4 Klassen, Prozesslauf und Fehlaufruf ok')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
