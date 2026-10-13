/**
 * Lokale Messung der D1-Schreibzeilen einer Meldung (workerd/miniflare via getPlatformProxy, nur
 * lokal, nie --remote). `meta.rows_written` zählt Tabelle UND Indexe, das tut `node:sqlite` nicht.
 *
 * Aufruf (aus dem Repo-Wurzelordner, `worker/node_modules` muss da sein):
 *   npx tsx tools/worker-schreibzeilen-messen.ts <db-ordner> <worker-ordner>
 * Die Datenbank (db-ordner = `<persist-to>/v3`) legt vorher `wrangler d1 execute anime-kalender --local --config wrangler.toml
 * --persist-to <db-ordner> --file=<alle Migrationen>` an (frischer Ordner). Mit `LAUT=1` bleiben
 * Fehlermeldungen des Workers sichtbar, mit `DETAIL=1` steht je Anweisung die Zeilenzahl dabei.
 */
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const [dbOrdner, workerOrdner] = process.argv.slice(2) as [string, string]
const wr = createRequire(pathToFileURL(workerOrdner + '/package.json').href)
const { getPlatformProxy } = await import(pathToFileURL(wr.resolve('wrangler')).href)
const { handlePruefung } = await import(pathToFileURL(`${workerOrdner}/src/pruefung.ts`).href)

if (!process.env.LAUT) console.error = () => {}
console.warn = () => {}
/** Der Listenbau (`pruefstand.json`), den der Worker über `fetch` holt; die Messung stellt ihn um. */
const stand = { erzeugtAm: '2020-01-02T00:00:00.000Z', anbieter: [] as unknown[] }
globalThis.fetch = (async () => new Response(JSON.stringify(stand))) as typeof fetch

const proxy = await getPlatformProxy({ configPath: `${workerOrdner}/wrangler.toml`, persist: { path: dbOrdner } })
const roh = proxy.env.DB as D1Database

type Abfrage = { sql: string; gelesen: number; geschrieben: number }
let summe = { gelesen: 0, geschrieben: 0, abfragen: [] as Abfrage[] }
const buche = (sql: string, r: { meta?: Record<string, unknown> }) => {
  const g = Number(r?.meta?.rows_read ?? 0)
  const s = Number(r?.meta?.rows_written ?? 0)
  summe.gelesen += g
  summe.geschrieben += s
  summe.abfragen.push({ sql: sql.replace(/\s+/g, ' ').slice(0, 70), gelesen: g, geschrieben: s })
  return r
}
const echte = new WeakMap<object, D1PreparedStatement>()
const huelle = (sql: string, stmt: D1PreparedStatement): D1PreparedStatement => {
  const h = new Proxy(stmt, {
    get(ziel, name) {
      if (name === 'bind') return (...a: unknown[]) => huelle(sql, ziel.bind(...a))
      if (name === 'run' || name === 'all') return async () => buche(sql, await (ziel as never as Record<string, () => Promise<never>>)[name]!())
      const w = Reflect.get(ziel, name)
      return typeof w === 'function' ? w.bind(ziel) : w
    },
  })
  echte.set(h, stmt)
  return h
}
const db = {
  prepare: (sql: string) => huelle(sql, roh.prepare(sql)),
  batch: async (liste: D1PreparedStatement[]) => {
    const antworten = await roh.batch(liste.map((s) => echte.get(s) ?? s))
    antworten.forEach((a, i) => buche('batch#' + i, a))
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

/** Eine Netflix-Meldung (je Folge eine); `notiz` ändert den Inhalt, ohne die Folge zu ändern. */
const netflix = (nr: number, notiz = 'Durchgang') => ({
  plattform: 'netflix',
  url: 'https://www.netflix.com/title/80000001',
  vorhanden: 'ja',
  ton_de: 'ja',
  art: 'gemessen',
  titel: 'NF Test',
  folge_nr: nr,
  staffel: 1,
  notiz,
  rohfolgen: [{ gti: `nf-${nr}`, nummer: nr, vorhanden: 'ja', ton_de: 'ja', roh: { liste: { runtimeSec: 1428 } } }],
})

async function messe(name: string, body: unknown) {
  summe = { gelesen: 0, geschrieben: 0, abfragen: [] }
  const r = await handlePruefung(post(body), env)
  const j = (await r.json()) as { unveraendert?: boolean }
  console.log(JSON.stringify({ name, status: r.status, geschrieben: summe.geschrieben, gelesen: summe.gelesen, unveraendert: !!j.unveraendert }))
  if (process.env.DETAIL) for (const a of summe.abfragen) console.log('     ', JSON.stringify(a))
}

/** Eine SQL-Anweisung messen (Kosten von UPDATE gegen INSERT, ohne den Worker). */
async function messeSql(name: string, sql: string, ...werte: unknown[]) {
  const r = await roh.prepare(sql).bind(...werte).run()
  console.log(JSON.stringify({ name, geschrieben: r.meta.rows_written, gelesen: r.meta.rows_read }))
}

const abhaken = () => roh.prepare('UPDATE pruefung SET uebernommen = 1').run()
const gestern = () => new Date(Date.now() - 86_400_000).toISOString().slice(0, 19) + 'Z'
const altern = () => roh.prepare('UPDATE pruefung SET gemeldet_am = ?1').bind(gestern()).run()
const alleStaende = async () => (await roh.prepare('SELECT id, uebernommen, gemeldet_am, notiz FROM pruefung ORDER BY id').all()).results

await messe('M1 erste Meldung', netflix(1))
await messe('M2 gleiche Meldung, offen, selber Tag', netflix(1))
await abhaken()
await messe('M3 gleiche Meldung, uebernommen, selber Tag', netflix(1))
await altern()
await messe('M4 gleiche Meldung, uebernommen, Zeile von gestern', netflix(1))
await abhaken()
stand.erzeugtAm = new Date(Date.now() + 3_600_000).toISOString()
await messe('M5 gleiche Meldung, uebernommen, nach neuem Listenbau', netflix(1))
stand.erzeugtAm = '2020-01-02T00:00:00.000Z'
await abhaken()
await messe('M6 andere Notiz, uebernommen', netflix(1, 'anderer Durchgang'))
await abhaken()
await messe('M7 zurueck zum alten Stand (A-B-A)', netflix(1))
console.log('Zeilen', JSON.stringify(await alleStaende()))
await messeSql('U1 UPDATE gemeldet_am', 'UPDATE pruefung SET gemeldet_am = ?1 WHERE id = ?2', gestern(), 1)
await messeSql('U2 UPDATE gemeldet_am + uebernommen = 0', 'UPDATE pruefung SET gemeldet_am = ?1, uebernommen = 0 WHERE id = ?2', new Date().toISOString(), 1)
await messeSql('U3 UPDATE uebernommen = 1 (zum Vergleich: Abhaken)', 'UPDATE pruefung SET uebernommen = 1 WHERE id = ?1', 1)
await messeSql('U4 UPDATE notiz (keine Indexspalte)', "UPDATE pruefung SET notiz = 'x' WHERE id = ?1", 1)
await proxy.dispose()
process.exit(0)
