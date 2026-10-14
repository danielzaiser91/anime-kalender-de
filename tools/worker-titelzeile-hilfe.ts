/**
 * **Prüfstand der Titelzeilen-Tests** (aus `worker-titelzeile.test.ts` herausgelöst, 14.10.2026): eine echte SQLite-Datenbank
 * (`node:sqlite`) mit den Migrationen des Workers hinter einer D1-Attrappe, die geschriebene Zeilen zählt und vor jedem
 * `UPDATE titel_zeile` einen Zusammenstoß einmischen kann. Wird von den Titelzeilen-Tests je Anbieter geteilt.
 */
import { DatabaseSync } from 'node:sqlite'
import { readdirSync, readFileSync } from 'node:fs'
import { handlePruefung } from '../worker/src/pruefung.ts'
import { lies as liesDaten, zaehleOffene } from '../worker/src/titelzeile-format.ts'

const NUR = /pruefung|prime_folge|such_erwartung|schreib_tag|lauf_status|titel_zeile/

export function neueDatenbank() {
  const db = new DatabaseSync(':memory:')
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

export const umgebung = (db: DatabaseSync, h: Hilfe, an = true) =>
  ({ LAUF_TOKEN: 't', SITE_URL: 'https://attrappe.test/', TITELZEILE_PLATTFORMEN: an ? 'disneyplus' : '', DB: d1(db, h) }) as never

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
  (await handlePruefung(new Request(`https://worker.test/pruefung?token=t&${suche}`), env).then((r) => r.json())) as Record<string, unknown>
export const zahl = (db: DatabaseSync, sql: string) => Number((db.prepare(sql).get() as { n: number }).n)

/** Die Zähler `offen_meldung`/`offen_rohfolge` jeder Titelzeile stimmen mit ihren Folgen überein (so überspringen die Leser Titel ohne offene Folgen). */
export function zaehlerStimmen(db: DatabaseSync): boolean {
  const zeilen = db.prepare('SELECT daten, offen_meldung, offen_rohfolge FROM titel_zeile').all() as { daten: string; offen_meldung: number; offen_rohfolge: number }[]
  return zeilen.every((z) => {
    const o = zaehleOffene(liesDaten(z.daten))
    return o.meldung === z.offen_meldung && o.rohfolge === z.offen_rohfolge
  })
}
