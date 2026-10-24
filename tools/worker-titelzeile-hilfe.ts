/**
 * **Prüfstand der Titelzeilen-Tests** (aus `worker-titelzeile.test.ts` herausgelöst, 14.10.2026): eine echte SQLite-Datenbank
 * (`node:sqlite`) mit den Migrationen des Workers hinter einer D1-Attrappe, die geschriebene Zeilen zählt und vor jedem
 * `UPDATE titel_zeile` einen Zusammenstoß einmischen kann. Wird von den Titelzeilen-Tests je Anbieter geteilt.
 */
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { handlePruefung } from '../worker/src/pruefung.ts'
import { lies as liesDaten, zaehleOffene } from '../worker/src/titelzeile-format.ts'
import { einspielLauf, type Abfrage } from './worker-titelzeile-einspielen-lauf.ts'

const NUR = /pruefung|prime_folge|such_erwartung|schreib_tag|lauf_status|titel_zeile/

export function neueDatenbank() {
  return migriere(new DatabaseSync(':memory:'))
}

/** Die Migrationen der Prüf-Tabellen (die übrigen setzen Tabellen voraus, die hier nicht gebraucht werden). */
export function migriere(db: DatabaseSync) {
  for (const f of readdirSync('worker/migrations').sort()) {
    const sql = readFileSync(`worker/migrations/${f}`, 'utf8')
    if (NUR.test(sql) && !f.startsWith('023')) db.exec(sql)
  }
  return db
}

type Anweisung = { run: () => Promise<unknown>; all: () => Promise<unknown>; first: () => Promise<unknown>; bind: (...w: unknown[]) => Anweisung }
export type Hilfe = { geschrieben: number; vorUpdate?: () => void }

export function d1(db: DatabaseSync, h: Hilfe) {
  const anweisung = (sql: string, werte: unknown[] = []): Anweisung => ({
    bind: (...w) => anweisung(sql, w),
    run: async () => {
      if (h.vorUpdate && sql.startsWith('UPDATE titel_zeile')) h.vorUpdate()
      const r = db.prepare(sql).run(...(werte as never[]))
      h.geschrieben += Number(r.changes)
      return { meta: { changes: Number(r.changes), rows_written: Number(r.changes), rows_read: 0 } }
    },
    all: async () => ({ results: db.prepare(sql).all(...(werte as never[])), meta: { rows_written: 0, rows_read: 0 } }),
    first: async () => db.prepare(sql).get(...(werte as never[])) ?? null,
  })
  return {
    prepare: (sql: string) => anweisung(sql),
    batch: async (liste: Anweisung[]) => {
      const antworten = []
      for (const a of liste) antworten.push(await a.run())
      return antworten
    },
  }
}

/** `an`: true = nur Disney+ (Pilot), false = Schalter leer, Text = Schalter wie in wrangler.toml. */
export const umgebung = (db: DatabaseSync, h: Hilfe, an: boolean | string = true) =>
  ({ LAUF_TOKEN: 't', SITE_URL: 'https://attrappe.test/', TITELZEILE_PLATTFORMEN: schalter(an), DB: d1(db, h) }) as never

const schalter = (an: boolean | string) => (an === true ? 'disneyplus' : an === false ? '' : an)

/** Die Verlustabfrage mit eingesetztem Anbieter, wie ihr Kopfkommentar es per sed vorgibt. */
export const verlustSql = (plattform: string) => readFileSync('worker/einmalig/titel-zeile-verlust.sql', 'utf8').replaceAll('__PLATTFORM__', plattform)

/**
 * Die Abfrage des Einspielens gegen die Testdatenbank (statt wrangler), mit `rows_read` wie an der D1 mal `faktor`: eine
 * Exportseite liest alle Zeilen ihres Id-Bereichs (jeder Anbieter, `SEARCH … rowid>?`), jede andere Abfrage ihre
 * Ergebniszeilen. `protokoll` sammelt die Abfragen.
 */
export const abfrageAus =
  (db: DatabaseSync, faktor = 1, protokoll: string[] = []): Abfrage =>
  (sql) => {
    protokoll.push(sql)
    const results = db.prepare(sql).all() as Record<string, unknown>[]
    return { results, meta: { rows_read: Math.round(faktor * gelesenIm(db, sql, results)) } }
  }

function gelesenIm(db: DatabaseSync, sql: string, results: Record<string, unknown>[]): number {
  const seite = /FROM (pruefung|prime_folge) WHERE .* AND id > (\d+)(?: AND id <= (\d+))? ORDER BY id LIMIT (\d+)$/s.exec(sql)
  if (!seite) return results.length
  const voll = results.length === Number(seite[4])
  const obergrenze = voll ? results.at(-1)!.id : seite[3]
  const bis = obergrenze === undefined ? '' : ` AND id <= ${Number(obergrenze)}`
  return zahl(db, `SELECT COUNT(*) AS n FROM ${seite[1]} WHERE id > ${seite[2]}${bis}`)
}

/**
 * Ein Lauf von `tools/worker-titelzeile-einspielen.ts` gegen die Testdatenbank (`einspielLauf` mit Tor, frischer Ordner = erster
 * Lauf), danach die Anweisungen ausgeführt. Gibt ihre Zahl zurück (0 = nichts mehr zu tun).
 */
export function spieleEin(db: DatabaseSync, plattform = 'disneyplus'): number {
  const ordner = mkdtempSync(join(tmpdir(), 'titelzeile-'))
  const { sql } = einspielLauf(plattform, ordner, abfrageAus(db), true)
  rmSync(ordner, { recursive: true })
  for (const a of sql) db.exec(a)
  return sql.length
}

/** Antwort von `data/pruefstand.json` für den Worker; die Tests setzen `anbieter` je Fall. */
export const stand = { erzeugtAm: '2020-01-02T00:00:00.000Z', anbieter: [] as unknown[] }
globalThis.fetch = (async () => new Response(JSON.stringify(stand))) as typeof fetch
/* Kein Edge-Cache in diesem Test: jede Anfrage rechnet neu. */
Object.assign(globalThis, { caches: { default: { match: async () => undefined, put: async () => undefined, delete: async () => false } } })

export const post = (body: unknown) =>
  new Request('https://worker.test/pruefung', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': 't' },
    body: JSON.stringify(body),
  })
export const loesche = (body: unknown) =>
  new Request('https://worker.test/pruefung', { method: 'DELETE', headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': 't' }, body: JSON.stringify(body) })
export const lies = async (env: never, suche: string) =>
  (await handlePruefung(new Request(`https://worker.test/pruefung?${suche}`, { headers: { Authorization: 'Bearer t' } }), env).then((r) => r.json())) as Record<string, unknown>
export const zahl = (db: DatabaseSync, sql: string) => Number((db.prepare(sql).get() as { n: number }).n)

/** Die Zähler `offen_meldung`/`offen_rohfolge` jeder Titelzeile stimmen mit ihren Folgen überein (so überspringen die Leser Titel ohne offene Folgen). */
export function zaehlerStimmen(db: DatabaseSync): boolean {
  const zeilen = db.prepare('SELECT daten, offen_meldung, offen_rohfolge FROM titel_zeile').all() as { daten: string; offen_meldung: number; offen_rohfolge: number }[]
  return zeilen.every((z) => {
    const o = zaehleOffene(liesDaten(z.daten))
    return o.meldung === z.offen_meldung && o.rohfolge === z.offen_rohfolge
  })
}
