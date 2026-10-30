/**
 * Prüft tools/zuordnungsbilanz.mjs mit zwei synthetischen Kopien (Wegwerf-Ordner) im echten Schema (alle
 * Migrationen aus worker/migrations/): neu, umgezogen, verloren, gleich, ohne Kennung, Mehrstaffel-Adresse,
 * Adresse nur in einem Stand, Netflix/Disney+ nur über die Sicht (veraltete Altzeilen zählen nicht), Alterswarnung,
 * Prozesslauf samt Exit-Code.
 * Aufruf: node tools/zuordnungsbilanz.test.mjs
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { alterswarnungen, formatiere, klasseVon, leseZuordnung, summen, vergleiche } from './zuordnungsbilanz.mjs'

const ordner = mkdtempSync(join(tmpdir(), 'zuordnungsbilanz-test-'))
const SKRIPT = join(fileURLToPath(import.meta.url), '..', 'zuordnungsbilanz.mjs')
const MIGRATIONEN = join(fileURLToPath(import.meta.url), '..', '..', 'worker', 'migrations')

/** Titelzeile im Format der Sicht: Folge als Feldliste, Index 8 = titel_id. */
const folge = (titelId) => [1, 1, null, null, null, 'ja', 'ja', null, titelId, null, null, null, null, null, null, null]

/**
 * Kopie im echten Schema. Zeilen: [tabelle, plattform, url, titel_id]; Tabelle `titel_zeile` legt eine Titelzeile an
 * (die Sicht `pruefung_titel` liest daraus). Die Migrationen, die `subscribers` brauchen, gehören nicht zur Kopie.
 */
function baueKopie(name, zeilen) {
  const pfad = join(ordner, name)
  const db = new DatabaseSync(pfad)
  try {
    for (const f of readdirSync(MIGRATIONEN).filter((n) => n.endsWith('.sql')).sort()) {
      try {
        db.exec(readFileSync(join(MIGRATIONEN, f), 'utf8'))
      } catch (e) {
        if (!/subscribers/.test(e.message)) throw e
      }
    }
    fuelle(db, zeilen)
  } finally {
    db.close()
  }
  return pfad
}

function fuelle(db, zeilen) {
  let nr = 0
  for (const [t, p, u, id] of zeilen) {
    if (t === 'pruefung') {
      db.prepare("INSERT INTO pruefung (plattform, url, befund, gemeldet_am, titel_id) VALUES (?, ?, 'dub', '2026-10-01', ?)").run(p, u, id)
    } else if (t === 'prime_folge') {
      // plattform bleibt beim Standard (primevideo), wenn keine Plattform angegeben ist
      if (p) db.prepare("INSERT INTO prime_folge (plattform, url, titel_id, gemeldet_am) VALUES (?, ?, ?, '2026-10-01')").run(p, u, id)
      else db.prepare("INSERT INTO prime_folge (url, titel_id, gemeldet_am) VALUES (?, ?, '2026-10-01')").run(u, id)
    } else {
      const daten = JSON.stringify({ t: 'T', f: id == null ? [] : [folge(id)] })
      db.prepare('INSERT INTO titel_zeile (url, plattform, nr, daten, gemeldet_am) VALUES (?, ?, ?, ?, ?)').run(u, p, ++nr, daten, '2026-10-01')
    }
  }
}

try {
  const alt = baueKopie('alt.sqlite', [
    ['pruefung', 'crunchyroll', 'n/gleich', 11],
    ['pruefung', 'crunchyroll', 'n/neu', null],
    ['pruefung', 'crunchyroll', 'n/umgezogen', 21],
    ['pruefung', 'crunchyroll', 'n/verloren', 31],
    ['prime_folge', null, 'p/staffeln', 41],
    ['prime_folge', null, 'p/staffeln', 42],
    ['pruefung', 'crunchyroll', 'n/nur-alt', 51],
    ['pruefung', 'primevideo', 'p/ohne', null],
    // Netflix/Disney+: nur die Sicht zählt, die veralteten Zeilen in pruefung/prime_folge nicht
    ['titel_zeile', 'netflix', 'nz/umzug', 81],
    ['pruefung', 'netflix', 'nz/umzug', 999],
    ['titel_zeile', 'disneyplus', 'dz/verlust', 91],
    ['prime_folge', 'disneyplus', 'dz/verlust', 91],
  ])
  const neu = baueKopie('neu.sqlite', [
    ['pruefung', 'crunchyroll', 'n/gleich', 11],
    ['pruefung', 'crunchyroll', 'n/neu', 61],
    ['pruefung', 'crunchyroll', 'n/umgezogen', 22],
    ['pruefung', 'crunchyroll', 'n/verloren', null],
    ['prime_folge', null, 'p/staffeln', 42],
    ['prime_folge', null, 'p/staffeln', 43],
    ['pruefung', 'crunchyroll', 'n/nur-neu', 71],
    ['pruefung', 'primevideo', 'p/ohne', null],
    ['titel_zeile', 'netflix', 'nz/umzug', 82],
    ['pruefung', 'netflix', 'nz/umzug', 999],
    ['titel_zeile', 'disneyplus', 'dz/verlust', null],
    ['prime_folge', 'disneyplus', 'dz/verlust', 91],
  ])

  // Plattform-Regel einzeln: Altzeilen von Netflix/Disney+ fallen heraus, die Sicht gilt
  assert.deepEqual([...leseZuordnung(alt).entries()].filter(([k]) => k.includes('nz/')), [['netflix nz/umzug', [81]]])
  assert.deepEqual([...leseZuordnung(neu).entries()].filter(([k]) => k.includes('dz/')), [], 'Sicht ohne Folge, die veraltete prime_folge-Zeile 91 zählt nicht')

  const z = vergleiche(leseZuordnung(alt), leseZuordnung(neu))
  const klasse = Object.fromEntries(z.map((r) => [r.adresse.split(' ')[1], r.klasse]))
  assert.deepEqual(klasse, {
    'dz/verlust': 'verloren',
    'n/gleich': 'gleich',
    'n/neu': 'neu',
    'n/nur-alt': 'verloren',
    'n/nur-neu': 'neu',
    'n/umgezogen': 'umgezogen',
    'n/verloren': 'verloren',
    'nz/umzug': 'umgezogen',
    'p/ohne': 'ohne',
    'p/staffeln': 'umgezogen',
  })
  assert.deepEqual(summen(z), { neu: 2, umgezogen: 3, verloren: 3, gleich: 1, ohne: 1 })
  assert.equal(z.find((r) => r.adresse === 'primevideo p/staffeln').alt.join(), '41,42', 'Menge sortiert, Standardplattform primevideo')
  assert.equal(z.find((r) => r.adresse === 'netflix nz/umzug').neu.join(), '82', 'Sicht, nicht die Altzeile 999')

  // Klassen einzeln, auch die Randfälle leer/leer und umgekehrte Reihenfolge der Argumente
  assert.equal(klasseVon([], []), 'ohne')
  assert.equal(klasseVon([1], [1]), 'gleich')
  assert.equal(klasseVon([], [1]), 'neu')
  assert.equal(klasseVon([1], []), 'verloren')
  assert.equal(klasseVon([1], [2]), 'umgezogen')
  assert.equal(klasseVon([1], [1, 2]), 'umgezogen')

  const text = formatiere(z)
  assert.match(text.split('\n')[0], /^Zuordnungsbilanz: 10 Adressen — neu 2, umgezogen 3, verloren 3, gleich 1, ohne 1$/)
  assert.ok(!text.includes('n/gleich') && !text.includes('p/ohne'), 'gleich und ohne drucken ohne --gleich nicht')
  assert.ok(formatiere(z, true).includes('n/gleich') && formatiere(z, true).includes('p/ohne'))
  assert.match(text, /umgezogen 21 -> 22 {2}crunchyroll n\/umgezogen/)
  assert.match(text, /verloren {2}31 -> - {2}crunchyroll n\/verloren/)

  // Alterswarnung: genau an der Grenze keine, eine Stunde drüber eine, beide Kopien einzeln
  const T0 = 1_000_000_000_000
  const h = 3600000
  assert.deepEqual(alterswarnungen({ a: T0 - 48 * h, b: T0 }, T0), [])
  assert.deepEqual(alterswarnungen({ a: T0 - 49 * h, b: T0 }, T0), ['⚠ WARNUNG Kopie a ist 49 h alt (Grenze 48 h)'])
  assert.equal(alterswarnungen({ a: T0 - 60 * h, b: T0 - 72 * h }, T0).length, 2)

  const lauf = spawnSync(process.execPath, ['--no-warnings', SKRIPT, alt, neu, '--gleich'], { encoding: 'utf8', windowsHide: true })
  assert.equal(lauf.status, 0, lauf.stderr)
  assert.match(lauf.stdout, /^Zuordnungsbilanz: 10 Adressen/, 'frische Kopien: keine Warnzeile davor')
  assert.match(lauf.stdout, /gleich {4}11 -> 11 {2}crunchyroll n\/gleich/)
  // Prozess mit alter Kopie: Datei-Zeitstempel zehn Tage zurück
  const zehnTage = new Date(Date.parse('2026-10-20T00:00:00Z'))
  utimesSync(alt, zehnTage, zehnTage)
  const alterLauf = spawnSync(process.execPath, ['--no-warnings', SKRIPT, alt, neu], { encoding: 'utf8', windowsHide: true })
  assert.equal(alterLauf.status, 0, alterLauf.stderr)
  assert.match(alterLauf.stdout.split('\n')[0], /^⚠ WARNUNG Kopie .*alt\.sqlite ist \d+ h alt \(Grenze 48 h\)$/)
  assert.match(alterLauf.stdout, /\nZuordnungsbilanz: 10 Adressen/)
  const fehl = spawnSync(process.execPath, ['--no-warnings', SKRIPT, join(ordner, 'fehlt.sqlite'), neu], { encoding: 'utf8', windowsHide: true })
  assert.equal(fehl.status, 2)
  console.log('zuordnungsbilanz.test: 10 Adressen in 5 Klassen, Netflix/Disney+ nur Sicht, Alterswarnung, Prozesslauf und Fehlaufruf ok')
} finally {
  rmSync(ordner, { recursive: true, force: true })
}
