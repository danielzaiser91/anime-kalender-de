/**
 * Lokale Messung der D1-Lesezeilen von `?stand=1` nach einem Abhaken (workerd/miniflare via getPlatformProxy, nur lokal,
 * nie --remote; 17.10.2026). `meta.rows_read` zählt Tabellen-, Index- und `json_each`-Zeilen, das tut `node:sqlite` nicht.
 *
 * Aufruf (aus dem Repo-Wurzelordner):
 *   npx tsx tools/worker-staffeln-seit-messen.ts <db-ordner> <worker-ordner>
 * Die Datenbank legt vorher `wrangler d1 execute anime-kalender --local --config wrangler.toml --persist-to <db-ordner>
 * --file=<Migrationen der Prüf-Tabellen>` an (frischer Ordner je Lauf). Mengen wie im Sollkonzept vom 16.10.2026: 812
 * Titelzeilen mit 27.736 Folgen (gemessen 17.10.2026), 18.000 Zeilen `pruefung`. Alle Folgen vor dem Prüfstand gemeldet; `ABGEHAKT` Titel
 * (Vorgabe 400) hakt der Bestandsbau nach dem Prüfstand ab, `GEMELDET` Titel (Vorgabe 6) bekommen danach je drei neue Folgen.
 */
import { DatabaseSync } from 'node:sqlite'
import { readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const [dbOrdner, workerOrdner] = process.argv.slice(2) as [string, string]
const wr = createRequire(pathToFileURL(process.cwd() + '/package.json').href)
const { getPlatformProxy } = await import(pathToFileURL(wr.resolve('wrangler')).href)
const { handlePruefung } = await import(pathToFileURL(`${workerOrdner}/src/pruefung.ts`).href)
const { berechnePruefstand } = await import(pathToFileURL(`${workerOrdner}/src/pruefung-stand.ts`).href)
const { staffelnSeit } = await import(pathToFileURL(`${workerOrdner}/src/titelzeile-lesen.ts`).href)
const { eintragsId } = await import(pathToFileURL(`${workerOrdner}/src/titelzeile-format.ts`).href)
console.error = () => {}
console.warn = () => {}

const persist = `${dbOrdner}/v3`
const dateiOrdner = `${persist}/d1/miniflare-D1DatabaseObject`
const datei = readdirSync(dateiOrdner).find((n) => n.endsWith('.sqlite') && n !== 'metadata.sqlite')!

const SEIT = '2026-10-16T12:00:00.000Z'
const ALT = '2026-10-10T08:00:00Z'
const NEU = '2026-10-16T13:30:00Z'
const TITEL = 812
const ABGEHAKT = Number(process.env.ABGEHAKT ?? 400)
const GEMELDET = Number(process.env.GEMELDET ?? 6)
const folgenZahl = (i: number) => (i === 0 ? 405 : 33 + (i % 10 < 7 ? 1 : 0))
const gemeldet = (i: number) => i % Math.floor(TITEL / GEMELDET) === 1

/** Eine Folge im Format der Titelzeile; offen (`uebernommen` 0) nur bei den Titeln, die der Bau gleich abhakt. */
const eintrag = (i: number, k: number, offen: boolean) => {
  const am = gemeldet(i) && k >= folgenZahl(i) - 3 ? NEU : ALT
  return [1 + Math.floor(k / 20), k + 1, `Folge ${k + 1} mit einem Titel`, `gti-${i}-${k}`, ['de', 'ja'], 'ja', 'ja', 'gemessen', 1000 + i, am, offen ? 0 : 1, 1, null, 0]
}

function fuelle(): number[] {
  const sq = new DatabaseSync(`${dateiOrdner}/${datei}`)
  const ids: number[] = []
  sq.exec('BEGIN')
  const ins = sq.prepare('INSERT INTO titel_zeile (url, plattform, nr, daten, gemeldet_am, offen_meldung, offen_rohfolge) VALUES (?, ?, ?, ?, ?, ?, 0)')
  let folgen = 0
  for (let i = 0; i < TITEL; i++) {
    const offen = i >= 100 && i < 100 + ABGEHAKT
    const f = Array.from({ length: folgenZahl(i) }, (_, k) => eintrag(i, k, offen))
    if (offen) ids.push(...f.map((e) => eintragsId(i + 1, e)!))
    folgen += f.length
    const plattform = i % 3 === 0 ? 'netflix' : 'disneyplus'
    ins.run(`https://www.${plattform}.com/title/${i}`, plattform, i + 1, JSON.stringify({ s: null, t: `Titel ${i}`, st: null, f }), gemeldet(i) ? NEU : ALT, offen ? f.length : 0)
  }
  const p = sq.prepare('INSERT INTO pruefung (plattform, url, befund, titel, staffel, gemeldet_am, uebernommen) VALUES (?, ?, ?, ?, ?, ?, 1)')
  for (let i = 0; i < 18000; i++) p.run('primevideo', `https://www.amazon.de/dp/P${i % 700}`, 'ja', `Prime ${i % 700}`, 1 + (i % 3), i % 1000 === 0 ? NEU : ALT)
  sq.exec('COMMIT')
  sq.close()
  console.log(JSON.stringify({ titel: TITEL, folgen, abzuhaken: ids.length }))
  return ids
}
const ids = fuelle()

const proxy = await getPlatformProxy({ configPath: `${process.cwd()}/worker/wrangler.toml`, persist: { path: persist } })
const roh = proxy.env.DB as D1Database
const z = { gelesen: 0, geschrieben: 0 }
const echte = new WeakMap<object, D1PreparedStatement>()
const huelle = (stmt: D1PreparedStatement): D1PreparedStatement => {
  const h = new Proxy(stmt, {
    get(ziel, name) {
      if (name === 'bind') return (...a: unknown[]) => huelle(ziel.bind(...a))
      if (name === 'all' || name === 'run') {
        return async () => {
          const r = await ziel.all()
          z.gelesen += Number(r.meta?.rows_read ?? 0)
          z.geschrieben += Number(r.meta?.rows_written ?? 0)
          return r
        }
      }
      const w = Reflect.get(ziel, name)
      return typeof w === 'function' ? w.bind(ziel) : w
    },
  })
  echte.set(h, stmt)
  return h
}
const unwrap = (s: D1PreparedStatement) => echte.get(s) ?? s
const env = {
  LAUF_TOKEN: 't',
  SITE_URL: 'https://attrappe.test/',
  DB: {
    prepare: (sql: string) => huelle(roh.prepare(sql)),
    batch: async (liste: D1PreparedStatement[]) => {
      const r = await roh.batch(liste.map(unwrap))
      for (const x of r) z.geschrieben += Number(x.meta?.rows_written ?? 0)
      return r
    },
  },
} as never
globalThis.fetch = (async () => new Response(JSON.stringify({ erzeugtAm: SEIT, anbieter: [] }))) as typeof fetch

async function messe(name: string, schritt: () => Promise<unknown>) {
  z.gelesen = 0
  z.geschrieben = 0
  const aus = await schritt()
  console.log(JSON.stringify({ name, gelesen: z.gelesen, geschrieben: z.geschrieben, aus }))
}

await messe('staffelnSeit vor dem Abhaken', async () => (await staffelnSeit(env, SEIT)).length)
const abhaken = new Request('https://worker.test/pruefung', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': 't' }, body: JSON.stringify({ uebernommen: ids }) })
await messe('Abhaken (Bestandsbau)', async () => (await handlePruefung(abhaken, env)).status)
await messe('staffelnSeit nach dem Abhaken', async () => (await staffelnSeit(env, SEIT)).length)
await messe('?stand=1 ohne Cache (staffelnSeit + wartende)', async () => (await berechnePruefstand({ env, antwort: (b: unknown) => Response.json(b) })).status)
await proxy.dispose()
