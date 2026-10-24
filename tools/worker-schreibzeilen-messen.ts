/**
 * Lokale Messung der D1-Schreibzeilen einer Meldung (workerd/miniflare via getPlatformProxy, nur
 * lokal, nie --remote). `meta.rows_written` zählt Tabelle UND Indexe, das tut `node:sqlite` nicht.
 *
 * Aufruf (aus dem Repo-Wurzelordner, `worker/node_modules` muss da sein):
 *   npx tsx tools/worker-schreibzeilen-messen.ts <db-ordner> <worker-ordner>
 * Die Datenbank (db-ordner = `<persist-to>/v3`) legt vorher `wrangler d1 execute anime-kalender --local --config wrangler.toml
 * --persist-to <db-ordner> --file=<alle Migrationen>` an (frischer Ordner). Mit `LAUT=1` bleiben
 * Fehlermeldungen des Workers sichtbar, mit `DETAIL=1` steht je Anweisung die Zeilenzahl dabei.
 * `SZENARIO=disney` misst stattdessen einen Disney+-Titel mit 41 Folgen (13.10.2026); `TITELZEILE=disneyplus` schaltet
 * die Titelzeile ein (Migration 055 muss in der Datenbank sein).
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
/* Kein Edge-Cache in der Messung: jede Leseabfrage rechnet neu. */
Object.assign(globalThis, { caches: { default: { match: async () => undefined, put: async () => undefined, delete: async () => false } } })

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
const env = { LAUF_TOKEN: 't', SITE_URL: 'https://attrappe.test/', TITELZEILE_PLATTFORMEN: process.env.TITELZEILE ?? '', DB: db } as never

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

/** Eine Disney+-Meldung wie die Erweiterung sie schickt: eine Folge je Anfrage, mit der einen Rohfolge. */
const disney = (staffel: number, nr: number, ton = 'ja') => ({
  plattform: 'disneyplus',
  url: 'https://www.disneyplus.com/browse/entity-messung',
  titelId: 100 + staffel,
  sprachen: ton === 'ja' ? ['de', 'ja'] : ['ja'],
  vorhanden: 'ja',
  ton_de: ton,
  art: 'gemessen',
  titel: 'Messserie',
  folge: `Folge ${staffel}-${nr}`,
  folge_nr: nr,
  staffel,
  staffeln: { anbieter: 'disney', staffeln: [{ nr: 1, folgen: 24 }, { nr: 2, folgen: 17 }] },
  serientitel: 'Messserie',
  rohfolgen: [{ gti: `pb-${staffel}-${nr}`, nummer: nr, titel: `Folge ${staffel}-${nr}`, sprachen: ['de', 'ja'], staffelNr: staffel, vorhanden: 'ja', ton_de: ton }],
})
const folgen41 = [...Array.from({ length: 24 }, (_, i) => [1, i + 1] as const), ...Array.from({ length: 17 }, (_, i) => [2, i + 1] as const)]

/** Mehrere Anfragen hintereinander (ein Durchgang), Summe und Mittel je Anfrage. */
async function messeDurchgang(name: string, bodies: unknown[]) {
  summe = { gelesen: 0, geschrieben: 0, abfragen: [] }
  for (const b of bodies) await handlePruefung(post(b), env)
  console.log(JSON.stringify({ name, anfragen: bodies.length, geschrieben: summe.geschrieben, gelesen: summe.gelesen, geschriebenJe: +(summe.geschrieben / bodies.length).toFixed(2), gelesenJe: +(summe.gelesen / bodies.length).toFixed(2) }))
}

/** Eine Leseabfrage des Workers (Bau, Erweiterung). */
async function messeLesen(name: string, suche: string, lies = false) {
  summe = { gelesen: 0, geschrieben: 0, abfragen: [] }
  const r = await handlePruefung(new Request(`https://worker.test/pruefung?${suche}`, { headers: { Authorization: 'Bearer t' } }), env)
  const j = (await r.json()) as { pruefungen?: { id: number }[]; folgen?: unknown[]; paare?: unknown[] }
  console.log(JSON.stringify({ name, status: r.status, zeilen: (j.pruefungen ?? j.folgen ?? j.paare ?? []).length, gelesen: summe.gelesen, geschrieben: summe.geschrieben }))
  return lies ? j : null
}

if (process.env.SZENARIO === 'disney') {
  await messeDurchgang('D1 erster Durchgang, 41 Folgen in 2 Staffeln', folgen41.map(([s, n]) => disney(s, n)))
  await messeDurchgang('D2 zweiter Durchgang, unverändert', folgen41.map(([s, n]) => disney(s, n)))
  await messeDurchgang('D3 Durchgang mit einer geänderten Folge', folgen41.map(([s, n]) => disney(s, n, s === 1 && n === 5 ? 'nein' : 'ja')))
  await messeLesen('L1 gemeldet (Erweiterung)', 'gemeldet=' + encodeURIComponent('https://www.disneyplus.com/browse/entity-messung'))
  const offen = (await messeLesen('L2 offene Meldungen (Bau)', '', true)) as { pruefungen: { id: number }[] }
  await messeLesen('L3 alle Meldungen (Urteile)', 'alle=1&nach=0')
  const offeneRoh = (await messeLesen('L4 offene Rohfolgen (Zuordner)', 'rohfolgen=1&nach=0', true)) as { folgen: { id: number }[] }
  await messeLesen('L5 alle Rohfolgen (Zuordnung, Urteile)', 'rohfolgen=1&alle=1&nach=0')
  summe = { gelesen: 0, geschrieben: 0, abfragen: [] }
  const ids = offen.pruefungen.map((x) => x.id)
  await handlePruefung(post({ uebernommen: ids }), env)
  console.log(JSON.stringify({ name: `A1 ${ids.length} Meldungen abhaken`, geschrieben: summe.geschrieben, gelesen: summe.gelesen }))
  summe = { gelesen: 0, geschrieben: 0, abfragen: [] }
  await handlePruefung(post({ rohfolgenUebernommen: offeneRoh.folgen.map((x) => x.id) }), env)
  console.log(JSON.stringify({ name: `A2 ${offeneRoh.folgen.length} Rohfolgen abhaken`, geschrieben: summe.geschrieben, gelesen: summe.gelesen }))
  await messeLesen('L2b offene Meldungen nach dem Abhaken (Bau, Dauerzustand)', '')
  await messeLesen('L4b offene Rohfolgen nach dem Abhaken (Zuordner, Dauerzustand)', 'rohfolgen=1&nach=0')
  await messeLesen('L6 Stand der Zählung (Erweiterung)', 'zaehlen=1&nummern=1')
  await proxy.dispose()
  process.exit(0)
}
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
