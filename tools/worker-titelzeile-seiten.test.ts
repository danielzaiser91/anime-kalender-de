/**
 * **Seitenweise Leser der Titelzeilen** (Migration 058, 16.10.2026): offene Rohfolgen (`fetch-rohfolgen.ts`), alle Rohfolgen
 * (`fetch-folgen-zuordnung.ts`, `fetch-urteile.ts`) und `?alle=1` lesen die Sicht `pruefung_titel` ab dem Titel der Marke und
 * hören in D1 nach `LIMIT` auf, statt je Seite alle Folgen auszupacken und zu sortieren.
 *
 * Geprüft gegen eine echte SQLite-Datenbank (`node:sqlite`) mit den Migrationen des Workers:
 * - gleiche Zeilen in gleicher Reihenfolge wie `ORDER BY id` über die ganze Sicht, über mehrere Seiten, mit Randwerten
 *   (Fassung 99, Staffel 999, Nummer 99999, leere Staffel) und Titeln, deren `nr` nicht der Einfügereihenfolge folgt;
 * - Plan: Zugriff über `titel_zeile_nr`, kein Durchlauf über alle Titel;
 * - Start ab dem Titel der Marke: ein Titel mit kaputtem JSON vor der Marke der zweiten Seite wird nie ausgepackt
 *   (sonst: „malformed JSON“). Den Abbruch nach `LIMIT` und die gelesenen Zeilen misst workerd (PR-Beschreibung).
 *
 * Aufruf: `npx tsx tools/worker-titelzeile-seiten.test.ts`
 */
import { DatabaseSync } from 'node:sqlite'
import { alleRohfolgen, offeneRohfolgen } from '../worker/src/rohfolgen-seiten.ts'
import { SEITE, type Seite } from '../worker/src/seiten-vereint.ts'
import { allePruefungen } from '../worker/src/titelzeile-lesen.ts'
import { zaehleOffene, type Eintrag, type TitelDaten } from '../worker/src/titelzeile-format.ts'
import { d1, neueDatenbank } from './worker-titelzeile-hilfe.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}

let saat = 7
const zufall = () => (saat = (saat * 1103515245 + 12345) % 2147483648) / 2147483648

/** Eine Folge mit Randwerten an festen Stellen; `i` zählt über alle Titel. */
function folge(i: number, k: number, offen: boolean): Eintrag {
  const staffel = i % 97 === 0 ? 999 : i % 89 === 0 ? null : 1 + Math.floor(k / 10)
  const nummer = i % 83 === 0 ? 99999 : (k % 10) + 1
  const fassung = i % 79 === 0 ? 99 : zufall() < 0.1 ? 1 + Math.floor(zufall() * 5) : 0
  const gti = zufall() < 0.03 ? null : `g${i}`
  const vorhanden = zufall() < 0.03 ? 'nein' : 'ja'
  return [staffel, nummer, `F${i}`, gti, ['de'], vorhanden, 'ja', 'gemessen', null, '2026-10-15T10:00:00Z', 1, offen && zufall() < 0.9 ? 0 : 1, null, fassung]
}

/** 900 Titel mit 1–30 Folgen; `nr` gemischt eingefügt, Folgen bei jedem dritten Titel absteigend abgelegt. */
function fuelle(db: DatabaseSync) {
  const nrs = Array.from({ length: 900 }, (_, k) => k + 1).sort(() => zufall() - 0.5)
  const einf = db.prepare('INSERT INTO titel_zeile (url, plattform, nr, daten, gemeldet_am, offen_meldung, offen_rohfolge) VALUES (?, ?, ?, ?, ?, 0, ?)')
  let i = 0
  for (const nr of nrs) {
    const f = Array.from({ length: 1 + Math.floor(zufall() * 30) }, (_, k) => folge(i++, k, nr % 7 !== 0))
    if (nr % 3 === 0) f.reverse()
    const daten: TitelDaten = { s: null, t: `T${nr}`, st: null, f }
    einf.run(`https://www.disneyplus.com/series/${nr}`, nr % 2 ? 'disneyplus' : 'netflix', nr, JSON.stringify(daten), '2026-10-15T10:00:00Z', zaehleOffene(daten).rohfolge)
  }
}

/** Alle Seiten wie die Pipeline (`weiter` bis null); gibt die Ids zurück. */
async function alleSeiten(lies: (nach: number) => Promise<Seite>): Promise<number[]> {
  const ids: number[] = []
  let nach = 0
  for (let s = 0; s < 20; s++) {
    const seite = await lies(nach)
    ids.push(...seite.zeilen.map((z) => z.id))
    if (!seite.weiter) break
    nach = seite.weiter
  }
  return ids
}

const ids = (db: DatabaseSync, wo: string) => (db.prepare(`SELECT id FROM pruefung_titel WHERE ${wo} ORDER BY id`).all() as { id: number }[]).map((z) => z.id)
const gleich = (a: number[], b: number[]) => a.length === b.length && a.every((x, k) => x === b[k])

const LESER = [
  { name: 'offene Rohfolgen', lies: offeneRohfolgen, wo: "offen_rohfolge > 0 AND roh_uebernommen = 0 AND gti IS NOT NULL AND (vorhanden IS NULL OR vorhanden <> 'nein')" },
  { name: 'alle Rohfolgen', lies: alleRohfolgen, wo: 'gti IS NOT NULL' },
  { name: '?alle=1', lies: allePruefungen, wo: '1' },
] as const

// Gleiche Zeilen, gleiche Reihenfolge
{
  const db = neueDatenbank()
  fuelle(db)
  const sqls: string[] = []
  const roh = d1(db, { geschrieben: 0 })
  const env = { DB: { prepare: (sql: string) => (sqls.push(sql), roh.prepare(sql)) } } as never
  for (const l of LESER) {
    const soll = ids(db, l.wo)
    const ist = await alleSeiten((n) => l.lies(env, n))
    pruefe(soll.length > 2 * SEITE, `${l.name}: Bestand reicht über mehr als zwei Seiten (${soll.length} Zeilen)`)
    pruefe(gleich(ist, soll), `${l.name}: dieselben Zeilen in derselben Reihenfolge wie ORDER BY id (${ist.length})`)
  }
  const titelSqls = [...new Set(sqls.filter((s) => s.includes('pruefung_titel')))]
  pruefe(titelSqls.length === 3, 'drei seitenweise Abfragen auf die Sicht')
  for (const sql of titelSqls) {
    const plan = (db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(0, SEITE, 0) as { detail: string }[]).map((z) => z.detail).join(' | ')
    pruefe(/SEARCH t USING INDEX titel_zeile_nr/.test(plan) && !/SCAN t\b/.test(plan), `Plan über titel_zeile_nr, kein Durchlauf über alle Titel: ${plan}`)
    // Nur mit `titel_nr` vorn in der Sortierung bricht D1 nach LIMIT ab (workerd: 124 statt 4.100 Zeilen); node:sqlite zeigt das nicht.
    pruefe(/ORDER BY titel_nr, id LIMIT/.test(sql), 'sortiert nach titel_nr, id (Abbruch nach LIMIT in D1)')
  }
}

// Start ab dem Titel der Marke: ein Titel vor der Marke (nr 3, nach der ersten Seite kaputt gemacht) wird nie ausgepackt.
// Den Abbruch nach LIMIT zeigt nur workerd (node:sqlite 3.50 sortiert alle Titel ab der Marke); gemessen in der PR-Beschreibung.
for (const l of LESER) {
  const db = neueDatenbank()
  fuelle(db)
  const env = { DB: d1(db, { geschrieben: 0 }) } as never
  const erste = await l.lies(env, 0)
  db.exec(`UPDATE titel_zeile SET daten = '{"f": [kaputt' WHERE nr = 3`)
  const zweite = await l.lies(env, erste.weiter ?? 0).then((s) => s.zeilen.length, () => -1)
  pruefe(zweite > 0, `${l.name}: zweite Seite ab der Marke, ohne den Titel davor (nr 3) auszupacken`)
}

if (fehler) {
  console.log(`\n${fehler} Prüfung(en) rot`)
  process.exit(1)
}
console.log('\nAlles in Ordnung.')
