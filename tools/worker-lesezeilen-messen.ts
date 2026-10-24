/**
 * Lokale Messung der D1-Lesezeilen der Rohfolgen-Abfragen (workerd/miniflare via getPlatformProxy,
 * nur lokal, nie --remote). `meta.rows_read` zählt Tabellen- und Indexzeilen, das tut `node:sqlite` nicht.
 *
 * Aufruf (aus dem Repo-Wurzelordner):
 *   npx tsx tools/worker-lesezeilen-messen.ts <db-ordner> <worker-ordner> [ausgabe.json]
 * Die Datenbank (db-ordner = `<persist-to>`) legt vorher `wrangler d1 execute anime-kalender --local
 * --config wrangler.toml --persist-to <db-ordner> --file=<Migrationen>` an (frischer Ordner). Das
 * Skript füllt sie mit Mengen wie am 12.10.2026 (pruefung ~17.800 Zeilen, ~3.900 offen; prime_folge
 * 55.000 Zeilen, ~13.800 offen), ruft die Abfragen über `handlePruefung` des gegebenen Worker-Ordners
 * und schreibt die Antworten nach `ausgabe.json`, damit zwei Stände (vorher/nachher) verglichen werden.
 */
import { DatabaseSync } from 'node:sqlite'
import { readdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const [dbOrdner, workerOrdner, ausgabe] = process.argv.slice(2) as [string, string, string | undefined]
const wr = createRequire(pathToFileURL(process.cwd() + '/package.json').href)
const { getPlatformProxy } = await import(pathToFileURL(wr.resolve('wrangler')).href)
const { handlePruefung } = await import(pathToFileURL(`${workerOrdner}/src/pruefung.ts`).href)
console.error = () => {}
console.warn = () => {}

const persist = `${dbOrdner}/v3`
const dateiOrdner = `${persist}/d1/miniflare-D1DatabaseObject`
const datei = readdirSync(dateiOrdner).find((n) => n.endsWith('.sqlite') && n !== 'metadata.sqlite')!

/** Zeitstempel wie der Worker sie schreibt, je Zeilennummer eine Minute später (eindeutig je Adresse). */
const zeit = (id: string) => `strftime('%Y-%m-%dT%H:%M:%SZ', 1759000000 + ${id} * 60, 'unixepoch')`

function fuelle() {
  const sq = new DatabaseSync(`${dateiOrdner}/${datei}`)
  if ((sq.prepare('SELECT COUNT(*) AS n FROM pruefung').get() as { n: number }).n > 0) return sq.close()
  const folge = (tabelle: string, spalten: string, zeilen: number, werte: string) =>
    sq.exec(`WITH RECURSIVE z(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM z WHERE i < ${zeilen})
             INSERT INTO ${tabelle} (${spalten}) SELECT ${werte} FROM z`)
  /* Prime: 700 Adressen, zwei Meldungen je Adresse, bei jeder dritten Adresse hat die jüngste keinen Titel. */
  folge('pruefung', 'plattform, url, befund, titel, gemeldet_am, uebernommen',
    1400, `'primevideo', 'https://www.amazon.de/dp/P' || ((i - 1) % 700), 'ja',
           CASE WHEN i > 700 AND (i % 3) = 0 THEN NULL ELSE 'Prime Serie ' || ((i - 1) % 700) END, ${zeit('i')}, CASE WHEN i % 9 < 2 THEN 0 ELSE 1 END`)
  /* Netflix: 120 Titel mit je 70 Folgen; Disney+: 40 Staffelseiten mit je 200 Folgen. */
  folge('pruefung', 'plattform, url, befund, titel, folge_nr, staffel, gemeldet_am, uebernommen',
    8400, `'netflix', 'https://www.netflix.com/title/' || ((i - 1) / 70), 'ja', 'NF ' || ((i - 1) / 70), ((i - 1) % 70) + 1, 1,
           ${zeit('(1400 + i)')}, CASE WHEN i % 9 < 2 THEN 0 ELSE 1 END`)
  folge('pruefung', 'plattform, url, befund, titel, folge_nr, staffel, gemeldet_am, uebernommen',
    8000, `'disney', 'https://www.disneyplus.com/series/' || ((i - 1) / 200), 'ja', 'D+ ' || ((i - 1) / 200), ((i - 1) % 200) + 1, 1,
           ${zeit('(9800 + i)')}, CASE WHEN i % 9 < 2 THEN 0 ELSE 1 END`)
  /* prime_folge: 55.000 Rohfolgen auf 700 Adressen, jede vierte offen (Altbestand übernommen). */
  folge('prime_folge', 'url, nummer, titel, plattform, gemeldet_am, uebernommen',
    55000, `'https://www.amazon.de/dp/P' || ((i - 1) / 79), ((i - 1) % 79) + 1, 'Folge ' || i, 'primevideo', ${zeit('(17800 + i)')},
            CASE WHEN i % 4 = 0 THEN 0 ELSE 1 END`)
  sq.close()
}
fuelle()

const proxy = await getPlatformProxy({ configPath: `${process.cwd()}/worker/wrangler.toml`, persist: { path: persist } })
const roh = proxy.env.DB as D1Database
let gelesen = 0
const echte = new WeakMap<object, D1PreparedStatement>()
const huelle = (stmt: D1PreparedStatement): D1PreparedStatement => {
  const h = new Proxy(stmt, {
    get(ziel, name) {
      if (name === 'bind') return (...a: unknown[]) => huelle(ziel.bind(...a))
      if (name === 'all' || name === 'first') {
        return async () => {
          const r = await ziel.all()
          gelesen += Number(r.meta?.rows_read ?? 0)
          return name === 'all' ? r : (r.results[0] ?? null)
        }
      }
      const w = Reflect.get(ziel, name)
      return typeof w === 'function' ? w.bind(ziel) : w
    },
  })
  echte.set(h, stmt)
  return h
}
const env = { LAUF_TOKEN: 't', SITE_URL: 'https://attrappe.test/', DB: { prepare: (sql: string) => huelle(roh.prepare(sql)) } } as never

const get = (suche: string) => new Request(`https://worker.test/pruefung?rohfolgen=1&${suche}`, { headers: { Authorization: 'Bearer t' } })
const seiten: Record<string, string> = {}

async function messe(name: string, suche: string): Promise<unknown> {
  gelesen = 0
  const r = await handlePruefung(get(suche), env)
  const text = await r.text()
  seiten[`${name}|${suche}`] = text
  console.log(JSON.stringify({ name, status: r.status, gelesen, bytes: text.length }))
  return JSON.parse(text)
}

/** Alle Seiten der offenen Rohfolgen, wie `pipeline/fetch-rohfolgen.ts` sie abholt. */
let nach = 0
let summe = 0
for (let seite = 1; seite <= 6; seite++) {
  gelesen = 0
  const j = (await messe(`offen Seite ${seite}`, `nach=${nach}`)) as { folgen: unknown[]; weiter: number | null }
  summe += gelesen
  if (!j.weiter) break
  nach = j.weiter
}
console.log(JSON.stringify({ name: 'offen, ein Durchgang', gelesen: summe }))
await messe('namen', 'namen=1')

/** Schreibkosten des Index für offene Rohfolgen: 100 Einfügungen, dann alle 100 abhaken (`meta.rows_written`). */
async function schreibe(name: string, sql: string) {
  const r = await roh.prepare(sql).run()
  console.log(JSON.stringify({ name, geschrieben: r.meta.rows_written }))
}
await schreibe('100 offene Rohfolgen einfuegen', `WITH RECURSIVE z(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM z WHERE i < 100)
  INSERT INTO prime_folge (url, nummer, titel, plattform, gemeldet_am, uebernommen)
  SELECT 'https://www.amazon.de/dp/Pneu', i, 'x', 'primevideo', '2026-10-12T12:00:00Z', 0 FROM z`)
await schreibe('100 Rohfolgen abhaken', 'UPDATE prime_folge SET uebernommen = 1 WHERE id > (SELECT MAX(id) - 100 FROM prime_folge)')

const kurz = (t: string) => createHash('sha256').update(t).digest('hex').slice(0, 12)
const auszug = Object.fromEntries(Object.entries(seiten).map(([k, t]) => [k, { sha: kurz(t), bytes: t.length }]))
if (ausgabe) writeFileSync(ausgabe, JSON.stringify({ seiten }, null, 1))
console.log(JSON.stringify(auszug))
await proxy.dispose()
