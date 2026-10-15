/**
 * Lokale Messung der D1-Lesezeilen einer Meldung der Erweiterung (POST /pruefung, Einzel und Stapel;
 * workerd/miniflare via getPlatformProxy, nur lokal, nie --remote). `meta.rows_read` zählt Tabellen-
 * und Indexzeilen, das tut `node:sqlite` nicht. Grundlage für `DECKEL_LESEN` (worker/src/tagesdeckel.ts).
 *
 * Aufruf (aus dem Repo-Wurzelordner):
 *   npx tsx tools/worker-meldung-lesezeilen-messen.ts <db-ordner> <worker-ordner>
 * Die Datenbank (db-ordner = `<persist-to>`) legt vorher je Datei `wrangler d1 execute anime-kalender
 * --local --config wrangler.toml --persist-to <db-ordner> --file=<schema.sql, dann jede Migration>` an
 * (frischer Ordner; Fehler „duplicate column" der alten Migrationen 002-005 sind harmlos).
 * Das Skript füllt `pruefung` und `prime_folge` mit Mengen wie am 12.10.2026 und meldet je Fall
 * die gelesenen Zeilen — einmal unabhängig gezählt (alle Anweisungen, auch die des Deckels selbst),
 * einmal so, wie der Deckel sie in `schreib_tag.gelesen` bucht.
 */
import { DatabaseSync } from 'node:sqlite'
import { readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const [dbOrdner, workerOrdner] = process.argv.slice(2) as [string, string]
const wr = createRequire(pathToFileURL(workerOrdner + '/package.json').href)
const { getPlatformProxy } = await import(pathToFileURL(wr.resolve('wrangler')).href)
const { handlePruefung } = await import(pathToFileURL(`${workerOrdner}/src/pruefung.ts`).href)
console.error = () => {}
console.warn = () => {}
/* Der Listenbau (`pruefstand.json`), den der Worker über `fetch` holt. */
globalThis.fetch = (async () => new Response(JSON.stringify({ erzeugtAm: '2020-01-02T00:00:00.000Z', anbieter: [] }))) as typeof fetch

const persist = `${dbOrdner}/v3`
const dateiOrdner = `${persist}/d1/miniflare-D1DatabaseObject`
const datei = readdirSync(dateiOrdner).find((n) => n.endsWith('.sqlite') && n !== 'metadata.sqlite')!

/** Bestand wie am 12.10.2026: `pruefung` ~17.800 Zeilen, `prime_folge` 55.000 (Hintergrund, nicht die Messadressen). */
function fuelle() {
  const sq = new DatabaseSync(`${dateiOrdner}/${datei}`)
  const folge = (tabelle: string, spalten: string, zeilen: number, werte: string) =>
    sq.exec(`WITH RECURSIVE z(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM z WHERE i < ${zeilen})
             INSERT INTO ${tabelle} (${spalten}) SELECT ${werte} FROM z`)
  folge('pruefung', 'plattform, url, befund, titel, folge_nr, staffel, gemeldet_am, uebernommen',
    17800, `'netflix', 'https://www.netflix.com/title/' || ((i - 1) / 70), 'dub', 'NF ' || ((i - 1) / 70), ((i - 1) % 70) + 1, 1,
            '2026-10-11T12:00:00Z', CASE WHEN i % 9 < 2 THEN 0 ELSE 1 END`)
  folge('prime_folge', 'url, nummer, titel, plattform, gemeldet_am, uebernommen',
    55000, `'https://www.amazon.de/dp/P' || ((i - 1) / 79), ((i - 1) % 79) + 1, 'Folge ' || i, 'primevideo', '2026-10-11T12:00:00Z',
            CASE WHEN i % 4 = 0 THEN 0 ELSE 1 END`)
  sq.close()
}
fuelle()

const proxy = await getPlatformProxy({ configPath: `${workerOrdner}/wrangler.toml`, persist: { path: persist } })
const roh = proxy.env.DB as D1Database
let gelesen = 0
const echte = new WeakMap<object, D1PreparedStatement>()
const huelle = (stmt: D1PreparedStatement): D1PreparedStatement => {
  const h = new Proxy(stmt, {
    get(ziel, name) {
      if (name === 'bind') return (...a: unknown[]) => huelle(ziel.bind(...a))
      if (name === 'run' || name === 'all') {
        return async () => {
          const r = await (ziel as never as Record<string, () => Promise<{ meta: { rows_read: number } }>>)[name]!()
          gelesen += Number(r.meta?.rows_read ?? 0)
          return r
        }
      }
      if (name === 'first') {
        return async () => {
          const r = await ziel.all()
          gelesen += Number(r.meta?.rows_read ?? 0)
          return r.results[0] ?? null
        }
      }
      const w = Reflect.get(ziel, name)
      return typeof w === 'function' ? w.bind(ziel) : w
    },
  })
  echte.set(h, stmt)
  return h
}
const db = {
  prepare: (sql: string) => huelle(roh.prepare(sql)),
  batch: async (liste: D1PreparedStatement[]) => {
    const antworten = await roh.batch(liste.map((s) => echte.get(s) ?? s))
    for (const a of antworten) gelesen += Number(a.meta?.rows_read ?? 0)
    return antworten
  },
}
const env = { LAUF_TOKEN: 't', SITE_URL: 'https://attrappe.test/', DB: db } as never

const post = (body: unknown) =>
  new Request('https://worker.test/pruefung', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': 't' },
    body: JSON.stringify(body),
  })

/** Gemeinsamer Kopf einer Meldung: die Folge ist vorhanden, gemessen, mit deutschem Ton. */
const kopf = (plattform: string, url: string, ton = 'ja') => ({
  plattform,
  url,
  vorhanden: 'ja',
  ton_de: ton,
  art: 'gemessen',
})

const disney = (seite: string, nr: number, ton = 'ja') => ({
  ...kopf('disneyplus', `https://www.disneyplus.com/de-de/browse/${seite}`, ton),
  titel: 'Disney Test',
  folge_nr: nr,
  staffel: 1,
  rohfolgen: [{ gti: `${seite}-${nr}`, nummer: nr, vorhanden: 'ja', ton_de: ton }],
})

const netflix = (titel: string, nr: number) => ({
  ...kopf('netflix', `https://www.netflix.com/title/${titel}`),
  titel: 'NF Test',
  folge_nr: nr,
  staffel: 1,
  rohfolgen: [
    {
      gti: `${titel}-${nr}`,
      nummer: nr,
      vorhanden: 'ja',
      ton_de: 'ja',
      roh: { liste: { runtimeSec: 1428 } },
    },
  ],
})

const primeFolge = (seite: string, i: number) => ({
  asin: `${seite}F${i}`,
  gti: `gti-${i}`,
  nummer: i + 1,
  titel: `Folge ${i + 1}`,
  sprachen: ['de'],
  vorhanden: 'ja',
  ton_de: 'ja',
})

const prime = (seite: string, folgen: number, notiz = 'Durchgang') => ({
  ...kopf('primevideo', `https://www.amazon.de/dp/${seite}`),
  seiten_kennung: seite,
  titel: 'Prime Test',
  notiz,
  rohfolgen: Array.from({ length: folgen }, (_, i) => primeFolge(seite, i)),
})

const gebucht = async () => ((await roh.prepare('SELECT COALESCE(SUM(gelesen), 0) AS n FROM schreib_tag').first<{ n: number }>())?.n ?? 0)

/** Eine Anfrage: unabhängig gezählte Lesezeilen (mit den Zeilen des Deckels selbst) und die im Zähler gebuchten. */
async function messe(name: string, body: unknown, anfragen = 1) {
  gelesen = 0
  const vorher = await gebucht()
  const r = await handlePruefung(post(body), env)
  const j = (await r.json()) as { unveraendert?: boolean }
  const gebucht2 = (await gebucht()) - vorher
  console.log(JSON.stringify({ name, status: r.status, gelesen, gebucht: gebucht2, unveraendert: !!j.unveraendert, anfragen }))
  return gelesen
}

/** Alle Folgen einer Seite einzeln melden (Disney+: eine Anfrage je Folge); Summe der Lesezeilen. */
async function durchgang(name: string, n: number, wahl: (nr: number) => unknown) {
  gelesen = 0
  const vorher = await gebucht()
  for (let nr = 1; nr <= n; nr++) await handlePruefung(post(wahl(nr)), env)
  console.log(JSON.stringify({ name, folgen: n, gelesen, gebucht: (await gebucht()) - vorher, jeFolge: Math.round(gelesen / n) }))
}

console.log('-- Disney+ (eine Anfrage je Folge)')
await messe('Disney+ erste Meldung, Seite neu', disney('neu-0', 1))
for (const n of [12, 24, 100, 200]) {
  const seite = `s${n}`
  for (let nr = 1; nr <= n; nr++) await handlePruefung(post(disney(seite, nr)), env)
  await messe(`Disney+ Folge unverändert, Seite mit ${n} Folgen`, disney(seite, 1))
  await messe(`Disney+ Folge geändert, Seite mit ${n} Folgen`, disney(seite, 2, 'nein'))
  await durchgang(`Disney+ Wiederholungsdurchgang über Seite mit ${n} Folgen`, n, (nr) => disney(seite, nr))
}

console.log('-- Netflix (Stapel zu 10 Folgen)')
for (const n of [24, 70]) {
  const titel = `n${n}`
  for (let i = 1; i <= n; i += 10) await handlePruefung(post({ stapel: Array.from({ length: Math.min(10, n - i + 1) }, (_, k) => netflix(titel, i + k)) }), env)
  await messe(`Netflix Stapel 10 unverändert, Titel mit ${n} Folgen`, { stapel: Array.from({ length: 10 }, (_, k) => netflix(titel, 1 + k)) })
  await messe(`Netflix Einzelmeldung unverändert, Titel mit ${n} Folgen`, netflix(titel, 1))
}
await messe('Netflix Stapel 10, Titel neu', { stapel: Array.from({ length: 10 }, (_, k) => netflix('neu', 1 + k)) })

console.log('-- Prime (eine Anfrage je Seite, alle Rohfolgen darin)')
await messe('Prime 90 Rohfolgen, Seite neu', prime('B0NEU', 90))
await messe('Prime 90 Rohfolgen, gleiche Meldung', prime('B0NEU', 90))
await messe('Prime 90 Rohfolgen, andere Notiz', prime('B0NEU', 90, 'anderer Durchgang'))
await roh.prepare("UPDATE prime_folge SET uebernommen = 1 WHERE url = 'https://www.amazon.de/dp/B0NEU'").run()
await roh.prepare("UPDATE pruefung SET uebernommen = 1 WHERE url = 'https://www.amazon.de/dp/B0NEU'").run()
await messe('Prime 90 Rohfolgen, alles übernommen, andere Notiz', prime('B0NEU', 90, 'dritter Durchgang'))
await messe('Prime 12 Rohfolgen, Seite neu', prime('B0KURZ', 12))

/* Titelzeile (Schalter wie live seit 15.10.2026): Ein neuer Titel ohne Zeile und ohne Altzeilen las am
   15.10.2026 je Anfrage ~50.000 Zeilen (Altzeilen-Prüfung über `prime_folge` ohne `url`-Index). */
console.log('-- Titelzeile (TITELZEILE_PLATTFORMEN=disneyplus,netflix)')
Object.assign(env as object, { TITELZEILE_PLATTFORMEN: 'disneyplus,netflix' })
await messe('Titelzeile Netflix Einzelmeldung, Titel neu', netflix('tz-neu-1', 1))
await messe('Titelzeile Netflix Einzelmeldung, gleicher Titel unverändert', netflix('tz-neu-1', 1))
await messe('Titelzeile Netflix Stapel 10, Titel neu', { stapel: Array.from({ length: 10 }, (_, k) => netflix('tz-neu-2', 1 + k)) })
await messe('Titelzeile Disney+ erste Meldung, Seite neu', disney('tz-neu-3', 1))
await messe('Titelzeile Disney+ zweite Folge derselben Seite', disney('tz-neu-3', 2))
await proxy.dispose()
process.exit(0)
