/**
 * Prüft die D1-Verbrauchsprüfung (`tools/d1-verbrauch.mjs`): das Messfenster ist der UTC-Tag (Stundenzählung
 * der Insights nachgebildet), die DDL-Lücke und `d1 info` fließen in die Bewertung ein, und der Aufruf
 * reicht Fenster, Limit und `--ddl` wirklich an `wrangler` bzw. die Bewertung weiter (Attrappe von `npx`).
 * Aufruf: node tools/d1-verbrauch.test.mjs
 */
import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ABFRAGEN_LIMIT,
  DDL_LUECKE_GEMESSEN,
  GRENZE_EINZELN,
  GRENZE_GESAMT,
  GRENZE_GESCHRIEBEN,
  KONTINGENT_GESCHRIEBEN,
  PUFFER_MINUTEN,
  WARNUNG_GESCHRIEBEN,
  bewerte,
  utcTagMinuten,
} from './d1-verbrauch-bewertung.mjs'

/* ---- Fenster: die Insights zählen in Stunden-Buckets ab `datetimeHour_geq = jetzt − Zeitraum` ---- */
const HEUTE = Date.UTC(2026, 9, 14)
const STUNDE = 3_600_000
const MINUTE = 60_000

/** Der erste Stunden-Bucket, den Wrangler mit Startzeit `start` einschließt. */
const ersterBucket = (start) => Math.ceil(start / STUNDE) * STUNDE

const zeitpunkte = [0, 1_000, 59_000, 60_000, 61_000, 3_599_000, STUNDE, STUNDE + 1_000, 10 * STUNDE + 3_000, 23 * STUNDE + 59 * MINUTE + 59_000]
for (let s = 0; s < 24 * STUNDE; s += 7 * MINUTE + 13_000) zeitpunkte.push(s)
for (const seit of zeitpunkte) {
  const jetzt = new Date(HEUTE + seit)
  const minuten = utcTagMinuten(jetzt)
  /* Wrangler rechnet seine eigene Uhr: bis zu 4 Minuten später gestartet (npx, Anmeldung). */
  for (const verzoegerung of [0, 4 * MINUTE]) {
    const start = jetzt.getTime() + verzoegerung - minuten * MINUTE
    assert.equal(ersterBucket(start), HEUTE, `ab ${seit / 1000} s nach 00:00 UTC (+${verzoegerung / MINUTE} min): erster Bucket ist 00:00 UTC des Tages`)
  }
}
assert.equal(utcTagMinuten(new Date(HEUTE + 10 * STUNDE + 3_000)), 10 * 60 + 1 + PUFFER_MINUTEN, '10:00:03 → 601 min + Puffer')

/* ---- Warnschwelle berücksichtigt die DDL-Lücke ---- */
assert.ok(
  WARNUNG_GESCHRIEBEN + DDL_LUECKE_GEMESSEN <= KONTINGENT_GESCHRIEBEN,
  'Insights-Summe an der Warnschwelle plus die gemessene DDL-Lücke bleibt unter dem Schreib-Kontingent',
)

/* ---- Bewertung: jeder Weg zu einem Ergebnis hat einen eigenen Fall ---- */
const leer = { gelesen: 100, geschrieben: 100, groesste: [] }
assert.deepEqual(bewerte(leer), { befunde: [], warnungen: [] }, 'ruhiger Tag')

const warn = bewerte({ ...leer, geschrieben: WARNUNG_GESCHRIEBEN + 1 })
assert.equal(warn.befunde.length, 0, 'Warnschwelle: nicht rot')
assert.equal(warn.warnungen.length, 1, 'Warnschwelle: eine Warnzeile')

const rot = bewerte({ ...leer, geschrieben: GRENZE_GESCHRIEBEN + 1 })
assert.equal(rot.befunde.length, 1, 'über der Schreibgrenze: rot')
assert.equal(rot.warnungen.length, 0)

/* Ohne DDL wäre dieser Tag unauffällig; erst die Migrationen des Tages machen ihn rot. */
assert.deepEqual(bewerte({ ...leer, geschrieben: 30_000 }), { befunde: [], warnungen: [] })
assert.equal(bewerte({ ...leer, geschrieben: 30_000, ddl: DDL_LUECKE_GEMESSEN + 20_000 }).befunde.length, 1, 'ddl zählt zu den Schreibzeilen')
assert.equal(bewerte({ ...leer, geschrieben: 30_000, ddl: 25_000 }).warnungen.length, 1, 'ddl hebt über die Warnschwelle')

const gesamt = bewerte({ gelesen: GRENZE_GESAMT + 1, geschrieben: 0, groesste: [{ query: 'a', totalRowsRead: GRENZE_EINZELN - 1 }] })
assert.equal(gesamt.befunde.length, 1, 'Gesamtsumme über der Grenze, keine Einzelabfrage darüber')
assert.match(gesamt.befunde[0], /Gesamtverbrauch/)

const einzeln = bewerte({ gelesen: GRENZE_EINZELN + 1, geschrieben: 0, groesste: [{ query: 'SELECT\n  gross', totalRowsRead: GRENZE_EINZELN + 1 }] })
assert.equal(einzeln.befunde.length, 1, 'eine Abfrage über der Einzelgrenze, Summe darunter')
assert.match(einzeln.befunde[0], /SELECT gross/, 'Abfragetext einzeilig')

/* d1 info (gleitend 24 h, mit DDL): nur Warnung, nie rot; die Zahlen sind Stand 14.10.2026 10:04 UTC. */
const info = { gelesen24h: 12_352_191, geschrieben24h: 87_116 }
const mitInfo = bewerte({ ...leer, info })
assert.equal(mitInfo.befunde.length, 0, 'd1 info macht nie rot')
assert.equal(mitInfo.warnungen.length, 2, 'über beiden Schwellen: zwei Warnungen')
assert.match(mitInfo.warnungen[0], /gelesene/)
/* Die Sperre griff am 14.10.2026 erst nach 9,1 Mio. gelesenen Zeilen: Gewarnt wird schon bei der halben Grenze. */
const nurLesen = bewerte({ ...leer, info: { gelesen24h: GRENZE_GESAMT + 1, geschrieben24h: 1 } })
assert.equal(nurLesen.warnungen.length, 1, 'knapp über der halben Lesegrenze (weit unter 5 Mio.): Warnung')
assert.match(nurLesen.warnungen[0], /gelesene/)
const nurSchreiben = bewerte({ ...leer, info: { gelesen24h: 1, geschrieben24h: WARNUNG_GESCHRIEBEN + 1 } })
assert.equal(nurSchreiben.warnungen.length, 1, 'über der Schreib-Warnschwelle (unter 100.000): Warnung')
assert.match(nurSchreiben.warnungen[0], /geschriebene/)
assert.equal(bewerte({ ...leer, info: { gelesen24h: GRENZE_GESAMT, geschrieben24h: WARNUNG_GESCHRIEBEN } }).warnungen.length, 0, 'genau auf den Schwellen: still')
assert.equal(bewerte({ ...leer, info: null }).warnungen.length, 0, 'ohne d1 info: still')

/* ---- Aufrufer: reicht d1-verbrauch.mjs Fenster, Limit und --ddl durch? (Attrappe von `npx`) ---- */
const werkstatt = mkdtempSync(join(tmpdir(), 'd1-verbrauch-test-'))
try {
  mkdirSync(join(werkstatt, 'worker'))
  mkdirSync(join(werkstatt, 'stub'))
  const aufrufe = join(werkstatt, 'aufrufe.txt')
  writeFileSync(
    join(werkstatt, 'stub', 'stub.mjs'),
    `import { appendFileSync } from 'node:fs'
const a = process.argv.slice(2)
appendFileSync(${JSON.stringify(aufrufe)}, a.join(' ') + '\\n')
const q = (query, gelesen, geschrieben) => ({ query, avgRowsRead: gelesen, totalRowsRead: gelesen, avgRowsWritten: geschrieben, totalRowsWritten: geschrieben, numberOfTimesRun: 1 })
if (a.includes('info')) console.log(JSON.stringify({ rows_read_24h: Number(process.env.INFO_GELESEN ?? 1000), rows_written_24h: 2000 }))
else console.log(JSON.stringify([q('SELECT 1', 1000, 5000)]))
`,
  )
  const knoten = process.execPath
  writeFileSync(join(werkstatt, 'stub', 'npx.cmd'), `@"${knoten}" "%~dp0stub.mjs" %*\r\n`)
  writeFileSync(join(werkstatt, 'stub', 'npx'), `#!/bin/sh\nexec "${knoten}" "$(dirname "$0")/stub.mjs" "$@"\n`)
  chmodSync(join(werkstatt, 'stub', 'npx'), 0o755)

  const skript = fileURLToPath(new URL('./d1-verbrauch.mjs', import.meta.url))
  const lauf = (...zusatz) => laufMit({}, ...zusatz)
  const laufMit = (umgebung, ...zusatz) => {
    rmSync(aufrufe, { force: true })
    const r = spawnSync(knoten, [skript, '--lokal', ...zusatz], {
      cwd: werkstatt,
      encoding: 'utf8',
      env: { ...process.env, ...umgebung, PATH: join(werkstatt, 'stub') + delimiter + process.env.PATH },
    })
    return { ...r, aufrufe: readFileSync(aufrufe, 'utf8').trim().split('\n') }
  }

  const tag = lauf()
  assert.equal(tag.status, 0, tag.stdout + tag.stderr)
  const insights = tag.aufrufe.filter((z) => z.includes('insights'))
  assert.equal(insights.length, 2, 'Lesen und Schreiben: zwei Insights-Anfragen')
  for (const z of insights) {
    assert.match(z, new RegExp(`--limit ${ABFRAGEN_LIMIT}\\b`), 'alle Abfragegruppen, nicht nur die größten')
    assert.match(z, /--time-period \d+m\b/, 'Standard: Minuten seit 00:00 UTC')
  }
  const minuten = Number(insights[0].match(/--time-period (\d+)m/)[1])
  assert.ok(minuten > PUFFER_MINUTEN && minuten <= 24 * 60 + PUFFER_MINUTEN, `Minuten seit 00:00 UTC plausibel (${minuten})`)
  assert.match(tag.stdout, /^D1-Verbrauch der letzten \d+ h \(UTC-Tag \d{4}-\d{2}-\d{2} seit 00:00 UTC\)/m, 'erste Zeile, die d1-verbrauch.yml herausgreift')
  assert.match(tag.stdout, /Nicht in den Insights: Migrations-DDL/, 'Lücke ausgewiesen')
  assert.match(tag.stdout, /d1 info, gleitende 24 h .*1\.000 gelesen, 2\.000 geschrieben/, 'd1 info ausgegeben')

  const gleitend = lauf('--zeitraum', '1d')
  assert.ok(gleitend.aufrufe.filter((z) => z.includes('insights')).every((z) => z.includes('--time-period 1d')), '--zeitraum bleibt gleitend')
  assert.match(gleitend.stdout, /^D1-Verbrauch der letzten 1d:/m)

  const warnt = lauf('--ddl', '50000')
  assert.equal(warnt.status, 0, 'Warnung allein ist nicht rot')
  assert.match(warnt.stdout, /::warning::D1-Verbrauch: 55\.000 geschriebene Zeilen/, '5.000 + --ddl 50.000')
  const viel = laufMit({ INFO_GELESEN: '12352191' })
  assert.equal(viel.status, 0, 'd1 info macht nie rot')
  assert.match(viel.stdout, /::warning::D1-Verbrauch: d1 info: 12\.352\.191 gelesene/, 'd1 info wird bewertet')
  const rotLauf = lauf('--ddl', '80000')
  assert.equal(rotLauf.status, 1, '5.000 + --ddl 80.000 über der Grenze')
  assert.match(rotLauf.stdout, /::error::D1-Verbrauch: 85\.000 geschriebene Zeilen/)
} finally {
  rmSync(werkstatt, { recursive: true, force: true })
}

console.log('d1-verbrauch.test.mjs: ok')
