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
import { DECKEL_LESEN, DECKEL_ZEILEN, RIEGEL_LESEN_JE_ANFRAGE, mitTagesdeckel, utcTag } from '../worker/src/tagesdeckel.ts'
import { istD1Tageslimit } from '../worker/src/d1-limit.ts'
import { type Env } from '../worker/src/env.ts'
import { festeUhr } from './feste-uhr.ts'

/** Feste Uhr für Test und Worker: kein Lauf hängt am UTC-Tageswechsel (K6). */
const FEST = new Date('2026-10-12T12:00:00Z')
festeUhr(FEST.toISOString())

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
console.error = () => {}
console.warn = () => {}

const NUR = /pruefung|prime_folge|such_erwartung|schreib_tag|lauf_status|titel_zeile/

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
/** Die Abfrage, die eine Meldung aus `pruefung` liest (seit Migration 053 über json_each, vorher FROM pruefung). */
const LESEN_PRUEFUNG = /FROM pruefung|CROSS JOIN pruefung p/

type Anweisung = { run: () => Promise<unknown>; all: () => Promise<unknown>; first: () => Promise<unknown>; bind: (...w: unknown[]) => Anweisung }
type Zaehler = { gelesen: number; fehler?: (sql: string, art: 'run' | 'all') => Error | null; extra?: (sql: string) => number }

/**
 * D1 mit `rows_read` = gelieferte Zeilen; `fehler` lässt gewählte Anweisungen wie das Tageslimit scheitern,
 * `extra` gibt gewählten Leseanweisungen zusätzliche gelesene Zeilen (wie ein Vollscan an der D1).
 */
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
      const gelesen = results.length + (zaehler.extra?.(sql) ?? 0)
      zaehler.gelesen += gelesen
      return { results, meta: { rows_written: 0, rows_read: gelesen } }
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

/** `titelzeile`: Anbieter auf dem Titelzeilen-Weg (`TITELZEILE_PLATTFORMEN`), sonst keiner. */
const umgebung = (db: DatabaseSync, zaehler: Zaehler = { gelesen: 0 }, titelzeile = '') =>
  ({ LAUF_TOKEN: 't', SITE_URL: 'https://attrappe.test/', TITELZEILE_PLATTFORMEN: titelzeile, DB: d1(db, zaehler) }) as never

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
  // Die zweite Meldung derselben Folge liest deren Zeile; eine neue Folge liest seit Migration 053 nichts.
  await handlePruefung(post(folge(1)), env)
  const stand = tag(db)
  pruefe(z.gelesen > 0, `die Meldungen lesen Zeilen (${z.gelesen})`)
  pruefe(stand?.gelesen === 0, `die Meldung bucht ihre gelesenen Zeilen nicht selbst, das tut mitLesedeckel für jede Anfrage (${stand?.gelesen} von ${z.gelesen})`)
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM schreib_tag') === 1, 'eine Zeile für den Tag (ein Upsert je Anfrage, kein zweiter Zähler)')
}
{
  const db = neueDatenbank()
  const env = umgebung(db)
  db.prepare('INSERT INTO schreib_tag (tag, zeilen, gelesen) VALUES (?, 0, ?)').run(utcTag(FEST), DECKEL_LESEN - 1)
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
  db.prepare('INSERT INTO schreib_tag (tag, zeilen, gelesen) VALUES (?, ?, 0)').run(utcTag(FEST), DECKEL_ZEILEN)
  pruefe((await handlePruefung(post(folge(1)), umgebung(db))).status === 429, 'der Schreib-Deckel gilt weiter')
}
{
  const db = neueDatenbank()
  const env = umgebung(db)
  await handlePruefung(post(folge(1)), env)
  const vorher = tag(db)!
  const r = await handlePruefung(post(folge(1)), env)
  const nachher = tag(db)!
  pruefe(((await r.json()) as { unveraendert?: boolean }).unveraendert === true, 'Ausgang: die Wiederholung ist unverändert')
  pruefe(nachher.zeilen - vorher.zeilen === 1, `eine unveränderte Meldung bucht ihre eigene Schreibzeile in den Zähler (+${nachher.zeilen - vorher.zeilen})`)
}
{
  const db = neueDatenbank()
  const env = umgebung(db)
  await handlePruefung(post(folge(1)), env)
  db.prepare('UPDATE schreib_tag SET zeilen = ?').run(DECKEL_ZEILEN - 3)
  const status: number[] = []
  for (let i = 0; i < 6; i++) status.push((await handlePruefung(post(folge(1)), env)).status)
  pruefe(status.includes(429), `eine Schleife unveränderter Meldungen erreicht den Schreib-Deckel (${status.join(' ')})`)
}
{
  const db = neueDatenbank()
  db.exec('ALTER TABLE schreib_tag DROP COLUMN gelesen')
  const meldungen: string[] = []
  console.error = (...a: unknown[]) => void meldungen.push(a.join(' '))
  const env = umgebung(db)
  const status = [(await handlePruefung(post(folge(1)), env)).status, (await handlePruefung(post(folge(2)), env)).status]
  console.error = () => {}
  pruefe(status.join() === '200,200', 'ein Fehler beim Zählen sperrt nicht (Spalte fehlt)')
  const aus = meldungen.filter((m) => m.includes('TAGESDECKEL AUS'))
  pruefe(aus.length === 1 && aus[0]!.includes('Migration 052'), `fehlende Migration 052: genau eine hörbare Zeile je Isolate (${aus.length})`)
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
  const env = umgebung(db, { gelesen: 0, fehler: (sql, art) => (art === 'all' && LESEN_PRUEFUNG.test(sql) ? LIMIT_LESEN : null) })
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
  pruefe(await limitAntwort(await handlePruefung(post({ ...folge(1), plattform: 'primevideo' }), env)), 'Limit beim Laden der Rohfolgen (Prime) (scheitert vor der Meldungszeile, der nächste Klick schreibt beides) -> 429')
}
{
  const db = neueDatenbank()
  const env = umgebung(db, { gelesen: 0, fehler: (sql, art) => (art === 'all' && LESEN_PRUEFUNG.test(sql) ? new Error('D1_ERROR: boom') : null) })
  pruefe((await handlePruefung(post(folge(1)), env)).status === 500, 'ein anderer D1-Fehler bleibt 500')
}

console.log('Riegel je Anfrage')
const NETFLIX = 'https://www.netflix.com/title/81000009'
const netflix = (nr: number) => ({
  plattform: 'netflix',
  url: NETFLIX,
  titel: 'Netflix-Serie',
  serientitel: 'Netflix-Serie',
  staffeln: { staffeln: [{ nr: 1, folgen: 10 }] },
  titelId: 501,
  sprachen: ['de|Deutsch', 'ja|Japanisch'],
  vorhanden: 'ja',
  ton_de: 'ja',
  art: 'gemessen',
  folge_nr: nr,
  staffel: 1,
})
const TITELZEILE_LESEN = /FROM titel_zeile WHERE url/
/** Protokollzeilen während `f`. */
const mitProtokoll = async <T>(f: () => Promise<T>): Promise<[T, string[]]> => {
  const zeilen: string[] = []
  console.error = (...a: unknown[]) => void zeilen.push(a.join(' '))
  try {
    return [await f(), zeilen]
  } finally {
    console.error = () => {}
  }
}
pruefe(RIEGEL_LESEN_JE_ANFRAGE > 1_200 && RIEGEL_LESEN_JE_ANFRAGE < 50_000, `Riegel über den gemessenen Anfragen, unter dem Fehlerfall (${RIEGEL_LESEN_JE_ANFRAGE})`)
{
  /* Genau an der Grenze: Die Grundlast der Meldung messen, den Rest über die Folgen-Abfrage auffüllen. */
  const probe: Zaehler = { gelesen: 0 }
  await handlePruefung(post(folge(1)), umgebung(neueDatenbank(), probe))
  const db = neueDatenbank()
  const z: Zaehler = { gelesen: 0, extra: (sql) => (LESEN_PRUEFUNG.test(sql) ? RIEGEL_LESEN_JE_ANFRAGE - probe.gelesen : 0) }
  const [r, protokoll] = await mitProtokoll(() => handlePruefung(post(folge(1)), umgebung(db, z)))
  pruefe(z.gelesen === RIEGEL_LESEN_JE_ANFRAGE && r.status === 200, `genau an der Grenze (${z.gelesen}): gespeichert`)
  pruefe((tag(db)?.gelesen ?? 0) === 0, `unter dem Riegel bucht die Meldung keine gelesenen Zeilen (${tag(db)?.gelesen})`)
  pruefe(!protokoll.some((p) => p.includes('RIEGEL JE ANFRAGE')), 'keine Riegel-Zeile im Protokoll')
  pruefe((await handlePruefung(post(folge(2)), umgebung(db))).status === 200, 'die nächste Meldung geht durch')
}
{
  const db = neueDatenbank()
  const z: Zaehler = { gelesen: 0, extra: (sql) => (TITELZEILE_LESEN.test(sql) ? 50_000 : 0) }
  const env = umgebung(db, z, 'netflix')
  const [r, protokoll] = await mitProtokoll(() => handlePruefung(post(netflix(1)), env))
  pruefe(zahl(db, "SELECT COUNT(*) AS n FROM titel_zeile WHERE plattform = 'netflix'") === 1, 'Ausgang: die Meldung ging den Titelzeilen-Weg')
  pruefe(r.status === 200, 'Titelzeilen-Weg über dem Riegel: die eigene Antwort bleibt (die Meldung ist gespeichert)')
  pruefe((tag(db)?.gelesen ?? 0) >= DECKEL_LESEN, `der Tag ist am Lese-Deckel (${tag(db)?.gelesen}): auch der Titelzeilen-Weg wird gezählt`)
  const zeile = protokoll.find((p) => p.includes('RIEGEL JE ANFRAGE')) ?? ''
  pruefe(zeile.includes(String(z.gelesen)), `die Protokollzeile nennt die gelesenen Zeilen (${zeile})`)
  pruefe(zeile.includes('in: SELECT nr, version, daten FROM titel_zeile'), 'und den SQL-Anfang der teuersten Anweisung')
  const folgend = await handlePruefung(post(netflix(2)), env)
  pruefe(folgend.status === 429 && ((await folgend.json()) as { tageslimit?: boolean }).tageslimit === true, 'die nächste Meldung bekommt die 429 des Tagesdeckels')
}
{
  const db = neueDatenbank()
  const env = umgebung(db, { gelesen: 0, extra: (sql) => (LESEN_PRUEFUNG.test(sql) ? RIEGEL_LESEN_JE_ANFRAGE + 1 : 0) })
  const r = await handlePruefung(post({ stapel: [folge(1), folge(2)] }), env)
  pruefe(r.status === 200 && (tag(db)?.gelesen ?? 0) >= DECKEL_LESEN, 'ein Stapel über dem Riegel sperrt den Tag')
  pruefe((await handlePruefung(post(folge(3)), env)).status === 429, 'danach 429')
}
{
  const db = neueDatenbank()
  /* Zwei Titel: jede Titelzeile liest 3.000, erst zusammen über dem Riegel. */
  const env = umgebung(db, { gelesen: 0, extra: (sql) => (TITELZEILE_LESEN.test(sql) ? 3_000 : 0) }, 'netflix')
  const zweiter = { ...netflix(1), url: `${NETFLIX}0` }
  const [r, protokoll] = await mitProtokoll(() => handlePruefung(post({ stapel: [netflix(1), netflix(2), zweiter] }), env))
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM pruefung') === 0 && zahl(db, 'SELECT COUNT(*) AS n FROM titel_zeile') === 2, 'Ausgang: der Stapel ging den Titelzeilen-Weg')
  pruefe(r.status === 200 && (tag(db)?.gelesen ?? 0) >= DECKEL_LESEN, 'ein Titelzeilen-Stapel über dem Riegel sperrt den Tag (titelzeile-stapel.ts wird gezählt)')
  const zeile = protokoll.find((p) => p.includes('RIEGEL JE ANFRAGE')) ?? ''
  pruefe(zeile.includes('Anweisung 6000 in: SELECT nr'), `gleiche Anweisungen werden für die teuerste summiert (${zeile.slice(0, 120)})`)
}
{
  /* Jeder Melde-Weg der Erweiterung (Einzel, Stapel, „nicht im Angebot", Titelzeile) läuft durch Deckel und Riegel. */
  const adn = { ...folge(1), plattform: 'adn', url: 'https://animationdigitalnetwork.com/video/1-test', seiten_kennung: 'k1' }
  const prime = { ...folge(1), plattform: 'primevideo', url: 'https://www.amazon.de/dp/B0TEST' }
  const wege: [string, unknown][] = [
    ['Disney+ einzeln', folge(1)],
    ['Disney+ Stapel', { stapel: [folge(1), folge(2)] }],
    ['Netflix Titelzeile', netflix(1)],
    ['Netflix Titelzeilen-Stapel', { stapel: [netflix(1), netflix(2)] }],
    ['Prime mit Rohfolgen', prime],
    ['ADN Stapel', { stapel: [adn, { ...adn, folge_nr: 2, rohfolgen: [{ gti: 'a2', nummer: 2, vorhanden: 'ja', ton_de: 'ja' }] }] }],
    ['ADN „nicht im Angebot"', { plattform: 'adn', url: adn.url, vorhanden: 'nein', art: 'gemessen', titel: 'Testtitel' }],
  ]
  const amDeckel: string[] = []
  const amRiegel: string[] = []
  for (const [name, meldung] of wege) {
    const voll = neueDatenbank()
    voll.prepare('INSERT INTO schreib_tag (tag, zeilen, gelesen) VALUES (?, 0, ?)').run(utcTag(FEST), DECKEL_LESEN)
    if ((await handlePruefung(post(meldung), umgebung(voll, { gelesen: 0 }, 'disneyplus,netflix'))).status !== 429) amDeckel.push(name)
    const db = neueDatenbank()
    const env = umgebung(db, { gelesen: 0, extra: () => RIEGEL_LESEN_JE_ANFRAGE + 1 }, 'disneyplus,netflix')
    const status = (await handlePruefung(post(meldung), env)).status
    if (status !== 200 || (tag(db)?.gelesen ?? 0) < DECKEL_LESEN) amRiegel.push(`${name} (${status})`)
  }
  pruefe(amDeckel.length === 0, `am Lese-Deckel bekommt jeder Melde-Weg 429 (durch: ${amDeckel.join(', ') || 'keiner'})`)
  pruefe(amRiegel.length === 0, `über dem Riegel sperrt jeder Melde-Weg den Tag (ohne Sperre: ${amRiegel.join(', ') || 'keiner'})`)
}
{
  /* Direkt am Deckel: `batch` trägt den SQL-Text weiter, das Protokoll kürzt auf 120 Zeichen. */
  const LANG = `SELECT x FROM prime_folge WHERE ${'url = ?1 AND '.repeat(20)}1`
  const anweisung = (sql: string) => ({
    sql,
    bind: () => anweisung(sql),
    first: async () => null,
    all: async () => ({ results: [], meta: { rows_read: 0 } }),
    run: async () => ({ meta: {} }),
  })
  const DB = {
    prepare: anweisung,
    batch: async (l: { sql: string }[]) => l.map((a) => ({ meta: { rows_read: a.sql === LANG ? RIEGEL_LESEN_JE_ANFRAGE + 1 : 0 } })),
  }
  const antwort = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status })
  const [, protokoll] = await mitProtokoll(() =>
    mitTagesdeckel({ env: { DB } as unknown as Env, antwort }, async (k) => {
      await k.env.DB.prepare('SELECT 1').all()
      await k.env.DB.batch([k.env.DB.prepare(LANG).bind(1)])
      return antwort({ ok: true })
    }),
  )
  const zeile = protokoll.find((p) => p.includes('RIEGEL JE ANFRAGE')) ?? ''
  pruefe(zeile.endsWith(`in: ${LANG.slice(0, 120)}`), `batch: die teuerste Anweisung mit ihren ersten 120 Zeichen (${zeile.length} Zeichen)`)
}
{
  const db = neueDatenbank()
  const extra = (sql: string) => (LESEN_PRUEFUNG.test(sql) ? RIEGEL_LESEN_JE_ANFRAGE + 1 : 0)
  const boom = (sql: string, art: 'run' | 'all') => (art === 'run' && /INSERT INTO pruefung/.test(sql) ? new Error('D1_ERROR: boom') : null)
  const r = await handlePruefung(post(folge(1)), umgebung(db, { gelesen: 0, extra, fehler: boom }))
  pruefe(r.status === 500 && (tag(db)?.gelesen ?? 0) >= DECKEL_LESEN, 'eine gescheiterte Anfrage über dem Riegel sperrt den Tag trotzdem')
  pruefe((await handlePruefung(post(folge(2)), umgebung(db))).status === 429, 'danach 429')
}
{
  const db = neueDatenbank()
  const boom = (sql: string, art: 'run' | 'all') => (art === 'run' && /INSERT INTO pruefung/.test(sql) ? new Error('D1_ERROR: boom') : null)
  const r = await handlePruefung(post(folge(1)), umgebung(db, { gelesen: 0, fehler: boom }))
  pruefe(r.status === 500 && tag(db) === undefined, 'eine gescheiterte Anfrage unter dem Riegel bucht nichts (wie bisher)')
}

if (fehler) {
  console.log(`\n${fehler} Fehler`)
  process.exit(1)
}
console.log('\nAlles in Ordnung.')
