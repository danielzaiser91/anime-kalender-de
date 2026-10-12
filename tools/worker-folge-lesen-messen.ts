/**
 * Lokale Messung der D1-Lesezeilen einer Folgen-Meldung (POST /pruefung) und Gegenprobe zweier Stände
 * (workerd/miniflare via getPlatformProxy, nur lokal, nie --remote). `meta.rows_read` zählt Tabellen-
 * und Indexzeilen, das tut `node:sqlite` nicht.
 *
 * Aufruf (aus dem Repo-Wurzelordner, je Stand ein frischer db-ordner):
 *   npx tsx tools/worker-folge-lesen-messen.ts <db-ordner> <worker-ordner> <ausgabe.json>
 * Das Skript legt die Datenbank selbst an (schema.sql, dann jede Migration des worker-ordners; Fehler
 * der alten Migrationen wie „duplicate column" sind harmlos), füllt den Hintergrund wie am 12.10.2026
 * (`pruefung` ~17.800 Zeilen), misst die Durchgänge und spielt dieselben Eingaben der Gegenprobe ab.
 * `ausgabe.json` enthält Messwerte, Antworten und den Endstand der Tabelle (ohne Zeitstempel); zwei
 * Stände sind gleich, wenn `gegenprobe` (Antworten und Endstand) in beiden Dateien übereinstimmt.
 */
import { DatabaseSync } from 'node:sqlite'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const [dbOrdner, workerOrdner, ausgabe] = process.argv.slice(2) as [string, string, string]
const wr = createRequire(pathToFileURL(workerOrdner + '/package.json').href)
const { getPlatformProxy } = await import(pathToFileURL(wr.resolve('wrangler')).href)
const { handlePruefung } = await import(pathToFileURL(`${workerOrdner}/src/pruefung.ts`).href)
console.error = () => {}
console.warn = () => {}
/* Der Listenbau (`pruefstand.json`), den der Worker über `fetch` holt. */
globalThis.fetch = (async () => new Response(JSON.stringify({ erzeugtAm: '2020-01-02T00:00:00.000Z', anbieter: [] }))) as typeof fetch

const persist = `${dbOrdner}/v3`
const dateiOrdner = `${persist}/d1/miniflare-D1DatabaseObject`
const proxyOptionen = { configPath: `${workerOrdner}/wrangler.toml`, persist: { path: persist } }

/** Legt die SQLite-Datei über einen ersten Zugriff an und wendet Schema und Migrationen an. */
async function legeDatenbankAn(): Promise<string> {
  const erste = await getPlatformProxy(proxyOptionen)
  await (erste.env.DB as D1Database).prepare('SELECT 1').first()
  await erste.dispose()
  const datei = `${dateiOrdner}/${readdirSync(dateiOrdner).find((n) => n.endsWith('.sqlite') && n !== 'metadata.sqlite')!}`
  const sq = new DatabaseSync(datei)
  const dateien = ['schema.sql', ...readdirSync(`${workerOrdner}/migrations`).sort().map((f) => `migrations/${f}`)]
  for (const f of dateien) {
    try {
      sq.exec(readFileSync(`${workerOrdner}/${f}`, 'utf8'))
    } catch {
      /* alte Migrationen wiederholen Spalten */
    }
  }
  sq.exec(`WITH RECURSIVE z(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM z WHERE i < 17800)
           INSERT INTO pruefung (plattform, url, befund, titel, folge_nr, staffel, gemeldet_am, uebernommen)
           SELECT 'netflix', 'https://www.netflix.com/title/' || ((i - 1) / 70), 'dub', 'NF ' || ((i - 1) / 70),
                  ((i - 1) % 70) + 1, 1, '2026-10-11T12:00:00Z', CASE WHEN i % 9 < 2 THEN 0 ELSE 1 END FROM z`)
  sq.close()
  return datei
}
const datei = await legeDatenbankAn()

const proxy = await getPlatformProxy(proxyOptionen)
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

type Antwort = { status: number; body: unknown }
async function sende(body: unknown): Promise<Antwort> {
  const r = await handlePruefung(post(body), env)
  return { status: r.status, body: await r.json().catch(() => null) }
}

const disney = (seite: string, nr: number, ton = 'ja') => ({
  plattform: 'disneyplus',
  url: `https://www.disneyplus.com/de-de/browse/${seite}`,
  vorhanden: 'ja',
  ton_de: ton,
  art: 'gemessen',
  titel: 'Disney Test',
  folge_nr: nr,
  staffel: 1,
  rohfolgen: [{ gti: `${seite}-${nr}`, nummer: nr, vorhanden: 'ja', ton_de: ton }],
})

const netflix = (titel: string, nr: number) => ({
  plattform: 'netflix',
  url: `https://www.netflix.com/title/${titel}`,
  vorhanden: 'ja',
  ton_de: 'ja',
  art: 'gemessen',
  titel: 'NF Test',
  folge_nr: nr,
  staffel: 1,
  rohfolgen: [{ gti: `${titel}-${nr}`, nummer: nr, vorhanden: 'ja', ton_de: 'ja', roh: { liste: { runtimeSec: 1428 } } }],
})

/** Alle Folgen einer Seite einzeln melden (Disney+: eine Anfrage je Folge); Summe der Lesezeilen. */
async function durchgang(name: string, n: number, wahl: (nr: number) => unknown) {
  gelesen = 0
  for (let nr = 1; nr <= n; nr++) await sende(wahl(nr))
  return { name, folgen: n, gelesen, jeFolge: Math.round((gelesen / n) * 10) / 10 }
}

async function messeDurchgaenge() {
  const werte = []
  for (const n of [24, 100, 200]) {
    const seite = `m${n}`
    werte.push(await durchgang(`Disney+ erster Durchgang, ${n} Folgen`, n, (nr) => disney(seite, nr)))
    werte.push(await durchgang(`Disney+ Wiederholung unverändert, ${n} Folgen`, n, (nr) => disney(seite, nr)))
    werte.push(await durchgang(`Disney+ Wiederholung mit geänderter Sprache, ${n} Folgen`, n, (nr) => disney(seite, nr, 'nein')))
  }
  gelesen = 0
  for (let i = 1; i <= 70; i += 10) await sende({ stapel: Array.from({ length: 10 }, (_, k) => netflix('mn70', i + k)) })
  werte.push({ name: 'Netflix Stapel zu 10, erster Durchgang, 70 Folgen', folgen: 70, gelesen, jeFolge: Math.round((gelesen / 70) * 10) / 10 })
  gelesen = 0
  for (let i = 1; i <= 70; i += 10) await sende({ stapel: Array.from({ length: 10 }, (_, k) => netflix('mn70', i + k)) })
  werte.push({ name: 'Netflix Stapel zu 10, Wiederholung, 70 Folgen', folgen: 70, gelesen, jeFolge: Math.round((gelesen / 70) * 10) / 10 })
  return werte
}

/**
 * Endstand der Tabellen ohne Zeitstempel und ohne Zeilen-IDs, sortiert nach Inhalt: Bei einem Stapel
 * laufen die Meldungen mit `Promise.all` nebeneinander (`pruefung-stapel.ts`), die IDs (`id`,
 * `meldung_id`) hängen also von der Reihenfolge der Datenbankzugriffe ab und sind je Lauf andere.
 */
async function stand() {
  const p = await roh.prepare('SELECT * FROM pruefung WHERE url LIKE ?').bind('%/g-%').all()
  const rf = await roh.prepare('SELECT * FROM prime_folge WHERE url LIKE ?').bind('%/g-%').all()
  const bereinigt = (z: Record<string, unknown>) => {
    const { id: _id, meldung_id: _meldung, ...rest } = z
    return JSON.stringify({ ...rest, gemeldet_am: z.gemeldet_am ? 'T' : null })
  }
  const geordnet = (zeilen: Record<string, unknown>[]) => zeilen.map(bereinigt).sort()
  return { pruefung: geordnet(p.results), prime_folge: geordnet(rf.results) }
}

const sq = () => new DatabaseSync(datei)
const sql = (text: string) => {
  const d = sq()
  d.exec(text)
  d.close()
}
const G = (n: string) => `https://www.disneyplus.com/de-de/browse/g-${n}`
const gm = (n: string, nr: number | null, extra: Record<string, unknown> = {}) => ({ ...disney(`g-${n}`, nr as number), folge_nr: nr, ...extra })

/** Dieselben Eingaben in fester Reihenfolge: Antworten und Endstand müssen in beiden Ständen gleich sein. */
async function gegenprobe() {
  const antworten: Antwort[] = []
  const s = async (b: unknown) => antworten.push(await sende(b))
  for (let nr = 1; nr <= 12; nr++) await s(gm('a', nr))
  for (let nr = 1; nr <= 12; nr++) await s(gm('a', nr))
  await s(gm('a', 2, { ton_de: 'nein' }))
  sql(`UPDATE pruefung SET uebernommen = 1 WHERE url = '${G('a')}'`)
  await s(gm('a', 1))
  await s(gm('a', 2, { ton_de: 'nein' }))
  await s(gm('a', 3, { ton_de: 'nein' }))
  await s(gm('a', 3))
  sql(`UPDATE pruefung SET uebernommen = 1 WHERE url = '${G('a')}'`)
  await s(gm('a', 3, { ton_de: 'nein' }))
  await s(gm('a', 3))
  sql(`INSERT INTO pruefung (plattform, url, befund, folge_nr, staffel, gemeldet_am, hash) SELECT plattform, url, befund, folge_nr, staffel, gemeldet_am, hash FROM pruefung WHERE url = '${G('a')}' AND folge_nr = 4 AND uebernommen = 0`)
  await s(gm('a', 4))
  await s(gm('a', 4, { ton_de: 'nein' }))
  sql(`UPDATE pruefung SET hash = NULL WHERE url = '${G('a')}' AND folge_nr = 5`)
  await s(gm('a', 5))
  await s(gm('a', 5))
  await s(gm('b', null))
  await s(gm('b', null))
  await s(gm('b', 1, { staffel: undefined }))
  await s(gm('b', 1, { staffel: undefined }))
  await s(gm('b', 1, { staffel: 2 }))
  await s(gm('b', 1, { seiten_kennung: 'K1' }))
  await s(gm('b', 1, { seiten_kennung: 'K2' }))
  await s(gm('b', 1, { seiten_kennung: 'K1', ton_de: 'nein' }))
  await s(gm('b', 1, { vorhanden: 'nein' }))
  await s({ ...gm('b', 1), url: `  ${G('b')}  ` })
  await s({ ...gm('b', 1), url: undefined })
  await s({ ...gm('b', 7), befund: 'weg', vorhanden: undefined, ton_de: undefined, art: undefined })
  await s({ ...gm('b', 1), vorhanden: 'vielleicht' })
  await s({ stapel: [gm('c', 1), gm('c', 2), gm('c', 1), gm('c', 1, { ton_de: 'nein' }), 'kaputt', gm('a', 1), gm('a', 2), gm('b', 1), { x: 1 }, gm('d', 3)] })
  await s({ stapel: [gm('c', 1), gm('c', 2), gm('d', 3), gm('d', 4)] })
  sql(`UPDATE pruefung SET uebernommen = 1 WHERE url IN ('${G('c')}', '${G('d')}')`)
  await s({ stapel: [gm('c', 1), gm('c', 2, { ton_de: 'nein' }), gm('d', 3), gm('d', 4)] })
  await s({ stapel: [] })
  return { antworten, stand: await stand() }
}

const messwerte = await messeDurchgaenge()
const probe = await gegenprobe()
console.log(JSON.stringify(messwerte, null, 1))
writeFileSync(ausgabe, JSON.stringify({ messwerte, gegenprobe: probe }, null, 1))
await proxy.dispose()
process.exit(0)
