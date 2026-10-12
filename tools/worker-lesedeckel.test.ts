/**
 * **Lese-Deckel der Meldungs-Route und echtes D1-Tageslimit** (12.10.2026).
 *
 * Gegen eine echte SQLite-Datenbank (`node:sqlite`) mit den Migrationen des Workers. `rows_read` ist
 * hier die Zahl der gelieferten Zeilen (SQLite zählt keine Indexzeilen); die genaue Messung steht in
 * `tools/worker-meldung-lesezeilen-messen.ts` (workerd). Nie gegen den echten Briefkasten.
 *
 * Aufruf: `npx tsx tools/worker-lesedeckel.test.ts`
 */
import { DatabaseSync } from 'node:sqlite'
import { readdirSync, readFileSync } from 'node:fs'
import { handlePruefung } from '../worker/src/pruefung.ts'
import { DECKEL_LESEN, DECKEL_ZEILEN, istD1Tageslimit, utcTag } from '../worker/src/tagesdeckel.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
console.error = () => {}
console.warn = () => {}

const NUR = /pruefung|prime_folge|such_erwartung|schreib_tag|lauf_status/

function neueDatenbank() {
  const db = new DatabaseSync(':memory:')
  for (const f of readdirSync('worker/migrations').sort()) {
    const sql = readFileSync(`worker/migrations/${f}`, 'utf8')
    if (NUR.test(sql) && !f.startsWith('023')) db.exec(sql)
  }
  return db
}

const LIMIT_LESEN = new Error("D1_ERROR: Your account has exceeded D1's free tier daily row read limit.")
const LIMIT_SCHREIBEN = new Error("D1_ERROR: Your account has exceeded D1's free tier daily row write limit.")

type Anweisung = { run: () => Promise<unknown>; all: () => Promise<unknown>; first: () => Promise<unknown>; bind: (...w: unknown[]) => Anweisung }
type Zaehler = { gelesen: number; fehler?: (sql: string, art: 'run' | 'all') => Error | null }

/** D1 mit `rows_read` = gelieferte Zeilen; `fehler` lässt gewählte Anweisungen wie das Tageslimit scheitern. */
function d1(db: DatabaseSync, zaehler: Zaehler) {
  const anweisung = (sql: string, werte: unknown[] = []): Anweisung => ({
    bind: (...w) => anweisung(sql, w),
    run: async () => {
      const f = zaehler.fehler?.(sql, 'run')
      if (f) throw f
      const r = db.prepare(sql).run(...(werte as never[]))
      return { meta: { changes: Number(r.changes), rows_written: Number(r.changes), rows_read: 0 } }
    },
    all: async () => {
      const f = zaehler.fehler?.(sql, 'all')
      if (f) throw f
      const results = db.prepare(sql).all(...(werte as never[]))
      zaehler.gelesen += results.length
      return { results, meta: { rows_written: 0, rows_read: results.length } }
    },
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

const umgebung = (db: DatabaseSync, zaehler: Zaehler = { gelesen: 0 }) =>
  ({ LAUF_TOKEN: 't', SITE_URL: 'https://attrappe.test/', DB: d1(db, zaehler) }) as never

globalThis.fetch = (async () => new Response(JSON.stringify({ erzeugtAm: '2020-01-02T00:00:00.000Z', anbieter: [] }))) as typeof fetch

const post = (body: unknown) =>
  new Request('https://worker.test/pruefung', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': 't' },
    body: JSON.stringify(body),
  })

const folge = (nr: number, ton = 'ja') => ({
  plattform: 'disneyplus',
  url: 'https://www.disneyplus.com/de-de/browse/entity-x',
  vorhanden: 'ja',
  ton_de: ton,
  art: 'gemessen',
  titel: 'Testtitel',
  folge_nr: nr,
  staffel: 1,
  rohfolgen: [{ gti: `pb-${nr}`, nummer: nr, vorhanden: 'ja', ton_de: ton }],
})

const zahl = (db: DatabaseSync, sql: string) => Number((db.prepare(sql).get() as { n: number }).n)
const tag = (db: DatabaseSync) => db.prepare('SELECT zeilen, gelesen FROM schreib_tag').get() as { zeilen: number; gelesen: number } | undefined

console.log('Lese-Deckel')
pruefe(DECKEL_LESEN > 0 && DECKEL_LESEN < 5_000_000, `DECKEL_LESEN liegt unter dem Tageskontingent von 5 Mio. (${DECKEL_LESEN})`)
{
  const db = neueDatenbank()
  const z: Zaehler = { gelesen: 0 }
  const env = umgebung(db, z)
  await handlePruefung(post(folge(1)), env)
  await handlePruefung(post(folge(2)), env)
  const stand = tag(db)
  pruefe(z.gelesen > 0, `die Meldungen lesen Zeilen (${z.gelesen})`)
  pruefe(stand?.gelesen === z.gelesen, `der Tageszähler bucht genau die gelesenen Zeilen der Meldungen (${stand?.gelesen} von ${z.gelesen})`)
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM schreib_tag') === 1, 'eine Zeile für den Tag (ein Upsert je Anfrage, kein zweiter Zähler)')
}
{
  const db = neueDatenbank()
  const env = umgebung(db)
  db.prepare('INSERT INTO schreib_tag (tag, zeilen, gelesen) VALUES (?, 0, ?)').run(utcTag(new Date()), DECKEL_LESEN - 1)
  pruefe((await handlePruefung(post(folge(1)), env)).status === 200, 'knapp unter dem Lese-Deckel: Meldung wird gespeichert')
  db.prepare('UPDATE schreib_tag SET gelesen = ?').run(DECKEL_LESEN)
  const r = await handlePruefung(post(folge(2)), env)
  const kopf = Number(r.headers.get('Retry-After'))
  const inhalt = (await r.json()) as { tageslimit?: boolean; error?: string; retryAfter?: number }
  pruefe(r.status === 429, 'am Lese-Deckel: 429, obwohl kaum geschrieben wurde')
  pruefe(kopf > 0 && kopf <= 86400 && inhalt.retryAfter === kopf, `Retry-After bis Mitternacht UTC (${kopf} s)`)
  pruefe(inhalt.tageslimit === true && inhalt.error === 'Tageslimit erreicht', 'dieselbe Antwort wie der Schreib-Deckel (tageslimit: true, die Erweiterung erkennt daran die Pause)')
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM pruefung') === 1, 'am Lese-Deckel wird nichts mehr geschrieben')
  pruefe((await handlePruefung(post({ stapel: [folge(2), folge(3)] }), env)).status === 429, 'auch ein Stapel bekommt 429')
  pruefe((await handlePruefung(post({ uebernommen: [1] }), env)).status === 200, 'Aufträge der Pipeline (abhaken) bleiben am Lese-Deckel frei')
  db.prepare('UPDATE schreib_tag SET tag = ?').run('2020-01-01')
  pruefe((await handlePruefung(post(folge(2)), env)).status === 200, 'am nächsten UTC-Tag ist der Zähler wieder leer')
}
{
  const db = neueDatenbank()
  db.prepare('INSERT INTO schreib_tag (tag, zeilen, gelesen) VALUES (?, ?, 0)').run(utcTag(new Date()), DECKEL_ZEILEN)
  pruefe((await handlePruefung(post(folge(1)), umgebung(db))).status === 429, 'der Schreib-Deckel gilt weiter')
}
{
  const db = neueDatenbank()
  db.exec('ALTER TABLE schreib_tag DROP COLUMN gelesen')
  pruefe((await handlePruefung(post(folge(1)), umgebung(db))).status === 200, 'ein Fehler beim Zählen sperrt nicht (Spalte fehlt)')
}

console.log('Echtes D1-Tageslimit wird zur 429 des Deckels')
{
  pruefe(istD1Tageslimit(LIMIT_LESEN) && istD1Tageslimit(LIMIT_SCHREIBEN), 'beide Wortlaute von D1 werden erkannt')
  pruefe(!istD1Tageslimit(new Error('D1_ERROR: no such table: x')) && !istD1Tageslimit(undefined), 'andere Fehler nicht')
}
const limitAntwort = async (r: Response) => {
  const kopf = Number(r.headers.get('Retry-After'))
  const inhalt = (await r.json()) as { tageslimit?: boolean }
  return r.status === 429 && kopf > 0 && kopf <= 86400 && inhalt.tageslimit === true
}
{
  const db = neueDatenbank()
  const env = umgebung(db, { gelesen: 0, fehler: (sql, art) => (art === 'all' && /FROM pruefung/.test(sql) ? LIMIT_LESEN : null) })
  pruefe(await limitAntwort(await handlePruefung(post(folge(1)), env)), 'Einzelmeldung: Lese-Limit von D1 -> 429 mit tageslimit und Retry-After (vorher 500)')
  pruefe(await limitAntwort(await handlePruefung(post({ stapel: [folge(1), folge(2)] }), env)), 'Stapel: Lese-Limit von D1 -> 429')
}
{
  const db = neueDatenbank()
  const env = umgebung(db, { gelesen: 0, fehler: (sql, art) => (art === 'run' && /INSERT INTO pruefung/.test(sql) ? LIMIT_SCHREIBEN : null) })
  pruefe(await limitAntwort(await handlePruefung(post(folge(1)), env)), 'Einzelmeldung: Schreib-Limit von D1 -> 429')
  pruefe(await limitAntwort(await handlePruefung(post({ stapel: [folge(1), folge(2)] }), env)), 'Stapel: jede Meldung scheitert am Schreib-Limit (im Stapel gefangen) -> trotzdem 429')
}
{
  const db = neueDatenbank()
  const env = umgebung(db, { gelesen: 0, fehler: (sql, art) => (art === 'all' && /FROM prime_folge/.test(sql) ? LIMIT_LESEN : null) })
  pruefe(await limitAntwort(await handlePruefung(post(folge(1)), env)), 'Limit beim Laden der Rohfolgen (dort gefangen, die Meldung ist gespeichert) -> 429')
}
{
  const db = neueDatenbank()
  const env = umgebung(db, { gelesen: 0, fehler: (sql, art) => (art === 'all' && /FROM pruefung/.test(sql) ? new Error('D1_ERROR: boom') : null) })
  pruefe((await handlePruefung(post(folge(1)), env)).status === 500, 'ein anderer D1-Fehler bleibt 500')
}

if (fehler) {
  console.log(`\n${fehler} Fehler`)
  process.exit(1)
}
console.log('\nAlles in Ordnung.')
