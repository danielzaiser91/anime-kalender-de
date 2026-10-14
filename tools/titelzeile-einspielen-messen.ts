/**
 * **Lesezeilen des Einspiel-SQL lokal messen** (14.10.2026; workerd/miniflare über getPlatformProxy, nie --remote).
 * `meta.rows_read` zählt Tabellen-, Index- und Zwischenzeilen wie die echte D1; `node:sqlite` zählt nicht.
 *
 * Aufruf (aus dem Repo-Wurzelordner, `<db-ordner>` frisch und leer):
 *   npx tsx tools/titelzeile-einspielen-messen.ts <db-ordner> <adressen-je-block> [altes-sql]
 * Füllt eine Datenbank mit allen Migrationen und Mengen wie am 12.10.2026 (pruefung 17.800 Zeilen: Prime 1.400 auf
 * 700 Adressen, Netflix 8.400 auf 120 Titeln, Disney+ 8.000 auf 350 Adressen; prime_folge 55.000 Prime-Zeilen dazu die
 * Rohfolgen der Disney+-/Netflix-Meldungen vor Migration 054), spielt je Anbieter Block für Block ein und gibt je Block
 * gelesene/geschriebene Zeilen aus. Mit `altes-sql` (eine frühere Fassung, nur Disney+) zuerst die Gegenprobe: altes und
 * neues SQL ergeben auf denselben Disney+-Daten dieselben Titelzeilen (Folgen sortiert verglichen).
 */
import { DatabaseSync } from 'node:sqlite'
import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { einspielSql, migriere, verlustSql } from './worker-titelzeile-hilfe.ts'

const [dbOrdner, blockText, altesSql] = process.argv.slice(2) as [string, string, string | undefined]
const wr = createRequire(pathToFileURL(process.cwd() + '/package.json').href)
const { getPlatformProxy } = await import(pathToFileURL(wr.resolve('wrangler')).href)
const persist = `${dbOrdner}/v3`
const proxyAuf = async () => await getPlatformProxy({ configPath: `${process.cwd()}/worker/wrangler.toml`, persist: { path: persist } })

/** Zeitstempel wie der Worker sie schreibt, je Zeilennummer eine Minute später. */
const zeit = (id: string) => `strftime('%Y-%m-%dT%H:%M:%SZ', 1759000000 + ${id} * 60, 'unixepoch')`

/** Erzeugt `zeilen` Zeilen aus einer Zahlenfolge `i` = 1..zeilen. */
const reihe = (sq: DatabaseSync, tabelle: string, spalten: string, zeilen: number, werte: string) =>
  sq.exec(`WITH RECURSIVE z(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM z WHERE i < ${zeilen})
           INSERT INTO ${tabelle} (${spalten}) SELECT ${werte} FROM z`)

/** Disney+: 350 Adressen, je 23 Folgen in zwei Staffeln; die ältere Hälfte mit Rohfolge in prime_folge, die jüngere in der Spalte. */
function fuelleDisney(sq: DatabaseSync) {
  const url = `'https://www.disneyplus.com/browse/entity-' || ((i - 1) % 350)`
  const k = '((i - 1) / 350)'
  const staffel = `(1 + ${k} / 12)`
  const nr = `(${k} % 12 + 1)`
  const folge = `'Folge ' || ${staffel} || '-' || ${nr}`
  const roh = `json_object('gti', 'pb-' || i, 'nummer', ${nr}, 'titel', ${folge}, 'staffel_nr', ${staffel}, 'sprachen', '["de","ja"]', 'vorhanden', 'ja', 'ton_de', 'ja')`
  reihe(sq, 'pruefung', 'plattform, url, sprachen, befund, titel, notiz, gemeldet_am, uebernommen, folge_nr, staffel, staffeln, serientitel, titel_id, folge, vorhanden, ton_de, art, rohfolge, roh_uebernommen', 8000,
    `'disneyplus', ${url}, '["de","ja"]', CASE WHEN i % 5 = 0 THEN 'kein_dub' ELSE 'dub' END, 'D+ ' || ((i - 1) % 350), NULL, ${zeit('i')},
     CASE WHEN i % 9 < 2 THEN 0 ELSE 1 END, ${nr}, ${staffel}, CASE WHEN i % 3 = 0 THEN NULL ELSE '{"anbieter":"disney","staffeln":[{"nr":1,"folgen":12}]}' END,
     'D+ ' || ((i - 1) % 350), 100 + ${staffel}, ${folge}, 'ja', CASE WHEN i % 5 = 0 THEN 'nein' ELSE 'ja' END, 'gemessen',
     CASE WHEN i > 4000 THEN ${roh} END, CASE WHEN i > 4000 THEN CASE WHEN i % 4 = 0 THEN 0 ELSE 1 END END`)
  reihe(sq, 'prime_folge', 'url, gti, nummer, titel, sprachen, staffel_nr, plattform, vorhanden, ton_de, gemeldet_am, uebernommen', 4000,
    `${url}, 'pb-' || i, ${nr}, ${folge}, '["de","ja"]', ${staffel}, 'disneyplus', 'ja', 'ja', ${zeit('i')}, CASE WHEN i % 4 = 0 THEN 0 ELSE 1 END`)
  /* Ältere Meldungen derselben Folgen (Wiederholungen) und eine Adresse nur mit Rohfolgen (gemessen am 14.10.: 27 Folgen). */
  reihe(sq, 'pruefung', 'plattform, url, befund, titel, gemeldet_am, uebernommen, folge_nr, staffel, folge, vorhanden, ton_de, art', 700,
    `'disneyplus', ${url}, 'kein_dub', 'D+ alt', ${zeit('(i - 5000)')}, 1, ${nr}, ${staffel}, ${folge}, 'ja', 'nein', 'gemessen'`)
  reihe(sq, 'prime_folge', 'url, gti, nummer, titel, staffel_nr, plattform, gemeldet_am, uebernommen', 27,
    `'https://www.disneyplus.com/browse/entity-nur-roh', 'pr-' || i, i, 'Roh ' || i, 1, 'disneyplus', ${zeit('i')}, 1`)
}

/** Netflix: 120 Titel mit je 70 Folgen; jede dritte angenommen, Altmeldungen ohne `art`, Hand-Meldungen mit `folgen`. */
function fuelleNetflix(sq: DatabaseSync) {
  const url = `'https://www.netflix.com/title/8' || ((i - 1) / 70)`
  const nr = `(((i - 1) % 70) % 35 + 1)`
  const staffel = `(1 + ((i - 1) % 70) / 35)`
  const angenommen = `(i % 3 = 0)`
  const roh = `json_object('gti', '9' || i, 'nummer', ${nr}, 'titel', 'Episode ' || ${nr}, 'staffel_nr', ${staffel}, 'roh', json_object('angenommen', json(CASE WHEN ${angenommen} THEN 'true' ELSE 'false' END)))`
  reihe(sq, 'pruefung', 'plattform, url, sprachen, befund, titel, folgen, notiz, gemeldet_am, uebernommen, folge_nr, staffel, staffeln, serientitel, titel_id, folge, vorhanden, ton_de, art, rohfolge, roh_uebernommen', 8400,
    `'netflix', ${url}, '["de|Deutsch","ja|Japanisch"]', 'dub', 'NF ' || ((i - 1) / 70), CASE WHEN i % 7 = 0 THEN 70 END,
     CASE WHEN ${angenommen} THEN 'Randprobe: ANGENOMMEN aus zwei Messungen' END, ${zeit('(8000 + i)')}, CASE WHEN i % 9 < 2 THEN 0 ELSE 1 END,
     ${nr}, ${staffel}, '{"staffeln":[{"nr":1,"folgen":35},{"nr":2,"folgen":35}]}', 'NF ' || ((i - 1) / 70), 500 + ${staffel}, '9' || i, 'ja', 'ja',
     CASE WHEN i % 10 = 1 THEN NULL WHEN ${angenommen} THEN 'angenommen' ELSE 'gemessen' END,
     CASE WHEN i > 3000 THEN ${roh} END, CASE WHEN i > 3000 THEN CASE WHEN i % 4 = 0 THEN 0 ELSE 1 END END`)
  reihe(sq, 'prime_folge', 'url, gti, nummer, titel, staffel_nr, plattform, roh, vorhanden, ton_de, gemeldet_am, uebernommen', 3000,
    `${url}, '9' || i, ${nr}, 'Episode ' || ${nr}, ${staffel}, 'netflix', json_object('angenommen', json(CASE WHEN ${angenommen} THEN 'true' ELSE 'false' END)),
     'ja', 'ja', ${zeit('(8000 + i)')}, CASE WHEN i % 4 = 0 THEN 0 ELSE 1 END`)
}

/** Prime wie `worker-lesezeilen-messen.ts`: 700 Adressen, zwei Seitenmeldungen je Adresse, 55.000 Rohfolgen. */
function fuellePrime(sq: DatabaseSync) {
  reihe(sq, 'pruefung', 'plattform, url, befund, titel, gemeldet_am, uebernommen', 1400,
    `'primevideo', 'https://www.amazon.de/dp/P' || ((i - 1) % 700), 'dub', 'Prime Serie ' || ((i - 1) % 700), ${zeit('(20000 + i)')}, CASE WHEN i % 9 < 2 THEN 0 ELSE 1 END`)
  reihe(sq, 'prime_folge', 'url, gti, nummer, titel, staffel_nr, plattform, gemeldet_am, uebernommen', 55000,
    `'https://www.amazon.de/dp/P' || ((i - 1) / 79), 'g' || i, ((i - 1) % 79) + 1, 'Folge ' || i, 1, 'primevideo', ${zeit('(22000 + i)')}, CASE WHEN i % 4 = 0 THEN 0 ELSE 1 END`)
}

/** Legt die Datenbank über den Proxy an (Datei), spielt alle Migrationen ein und füllt sie. */
async function legeAn() {
  const p = await proxyAuf()
  await (p.env.DB as D1Database).prepare('SELECT 1').all()
  await p.dispose()
  const ordner = `${persist}/d1/miniflare-D1DatabaseObject`
  const datei = readdirSync(ordner).find((n) => n.endsWith('.sqlite') && n !== 'metadata.sqlite')!
  const sq = new DatabaseSync(`${ordner}/${datei}`)
  migriere(sq)
  fuelleDisney(sq)
  fuelleNetflix(sq)
  fuellePrime(sq)
  sq.close()
}


/** Blöcke bis keiner mehr schreibt; je Block gelesene und geschriebene Zeilen. */
async function spieleEin(db: D1Database, plattform: string, adressen: number) {
  let summe = 0
  /* Ein Block mit weniger Titeln als `adressen` war der letzte; ein weiterer kostete die Grundlast für nichts. */
  for (let block = 1, titel = adressen; titel === adressen; block++) {
    const r = await db.prepare(einspielSql(plattform, adressen)).run()
    titel = r.meta.changes
    summe += r.meta.rows_read
    console.log(JSON.stringify({ plattform, block, gelesen: r.meta.rows_read, geschrieben: r.meta.rows_written, titel }))
  }
  const v = await db.prepare(verlustSql(plattform)).all()
  console.log(JSON.stringify({ plattform, adressen, gelesenGesamt: summe, verlust: v.results, verlustGelesen: v.meta.rows_read }))
}

/** Titelzeilen vergleichbar: Folgen sortiert. */
async function titelzeilen(db: D1Database, plattform: string): Promise<string> {
  const { results } = await db.prepare('SELECT url, nr, version, daten, gemeldet_am, offen_meldung, offen_rohfolge FROM titel_zeile WHERE plattform = ?1 ORDER BY url').bind(plattform).all<Record<string, unknown>>()
  return JSON.stringify(results.map((z) => {
    const d = JSON.parse(String(z.daten)) as { f: unknown[] }
    return { ...z, daten: { ...d, f: d.f.map((e) => JSON.stringify(e)).sort() } }
  }))
}

/** Altes SQL einspielen, Ergebnis merken, Titelzeilen löschen; das neue muss dasselbe liefern. */
async function gegenprobe(db: D1Database, adressen: number) {
  const r = await db.prepare(readFileSync(altesSql!, 'utf8')).run()
  console.log(JSON.stringify({ altesSql: 'disneyplus', gelesen: r.meta.rows_read, geschrieben: r.meta.rows_written, titel: r.meta.changes }))
  const alt = await titelzeilen(db, 'disneyplus')
  await db.prepare("DELETE FROM titel_zeile WHERE plattform = 'disneyplus'").run()
  await spieleEin(db, 'disneyplus', adressen)
  const neu = await titelzeilen(db, 'disneyplus')
  console.log(JSON.stringify({ gegenprobe: alt === neu ? 'gleich' : 'VERSCHIEDEN', titel: (JSON.parse(alt) as unknown[]).length }))
  if (alt !== neu) process.exitCode = 1
}

await legeAn()
const proxy = await proxyAuf()
const db = proxy.env.DB as D1Database
const adressen = Number(blockText)
if (altesSql) await gegenprobe(db, adressen)
else await spieleEin(db, 'disneyplus', adressen)
await spieleEin(db, 'netflix', adressen)
await spieleEin(db, 'primevideo', adressen)
await proxy.dispose()
