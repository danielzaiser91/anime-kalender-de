/**
 * **Tagesdeckel und Hash-Überspringen der Meldungs-Route** (11.10.2026).
 *
 * Gegen eine echte SQLite-Datenbank (`node:sqlite`) mit den Migrationen des Workers, die Antworten
 * verhalten sich wie die von D1: `meta.rows_written` ist hier die Zahl geänderter Tabellenzeilen
 * (ohne Indexzeilen — die genaue Messung mit Indexen steht im PR, lokal mit `getPlatformProxy`).
 * Nie gegen den echten Briefkasten.
 *
 * Aufruf: `npx tsx tools/worker-tagesdeckel.test.ts`
 */
import { DatabaseSync } from 'node:sqlite'
import { readdirSync, readFileSync } from 'node:fs'
import { handlePruefung } from '../worker/src/pruefung.ts'
import { berechnePruefstand } from '../worker/src/pruefung-stand.ts'
import { DECKEL_ZEILEN, utcTag, sekundenBisMitternachtUtc } from '../worker/src/tagesdeckel.ts'

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
  const ordner = 'worker/migrations'
  for (const f of readdirSync(ordner).sort()) {
    const sql = readFileSync(`${ordner}/${f}`, 'utf8')
    if (!NUR.test(sql) || f.startsWith('023')) continue
    db.exec(sql)
  }
  return db
}

type Anweisung = { run: () => Promise<unknown>; all: () => Promise<unknown>; first: () => Promise<unknown>; bind: (...w: unknown[]) => Anweisung }

/* Jede ausgeführte Anweisung mit ihren Werten, damit der Test ihren Plan (EXPLAIN QUERY PLAN) prüfen kann. */
const abfragen: { sql: string; werte: unknown[] }[] = []

function d1(db: DatabaseSync, zaehler: { geschrieben: number }) {
  const anweisung = (sql: string, werte: unknown[] = []): Anweisung => ({
    bind: (...w) => anweisung(sql, w),
    run: async () => {
      abfragen.push({ sql, werte })
      const r = db.prepare(sql).run(...(werte as never[]))
      zaehler.geschrieben += Number(r.changes)
      return { meta: { changes: Number(r.changes), rows_written: Number(r.changes) } }
    },
    all: async () => {
      abfragen.push({ sql, werte })
      return { results: db.prepare(sql).all(...(werte as never[])), meta: { rows_written: 0 } }
    },
    first: async () => {
      abfragen.push({ sql, werte })
      return db.prepare(sql).get(...(werte as never[])) ?? null
    },
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

function umgebung(db: DatabaseSync, zaehler = { geschrieben: 0 }) {
  return { LAUF_TOKEN: 't', SITE_URL: 'https://attrappe.test/', DB: d1(db, zaehler) } as never
}

/* Der Listenbau (data/pruefstand.json), den der Worker per fetch liest; `stand` setzt jeder Fall selbst. */
const stand = { erzeugtAm: '2020-01-02T00:00:00.000Z', anbieter: [] as unknown[] }
globalThis.fetch = (async () => new Response(JSON.stringify(stand))) as typeof fetch

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

console.log('Tagesdeckel')
{
  const jetzt = new Date('2026-10-11T23:30:00Z')
  pruefe(utcTag(jetzt) === '2026-10-11', 'der Tag zählt in UTC (Kontingent-Reset 00:00 UTC)')
  pruefe(sekundenBisMitternachtUtc(jetzt) === 30 * 60, 'Retry-After: 30 Minuten vor Mitternacht UTC')
}
{
  const db = neueDatenbank()
  const z = { geschrieben: 0 }
  const env = umgebung(db, z)
  const r = await handlePruefung(post(folge(1)), env)
  pruefe(r.status === 200, 'unter dem Deckel: Meldung wird gespeichert')
  const heute = (db.prepare('SELECT zeilen FROM schreib_tag').get() as { zeilen: number } | undefined)?.zeilen
  pruefe(heute !== undefined && heute > 0, `die geschriebenen Zeilen werden gezählt (${heute})`)
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM pruefung') === 1 && zahl(db, 'SELECT COUNT(*) AS n FROM prime_folge') === 1, 'je eine Zeile in pruefung und prime_folge')
}
{
  const db = neueDatenbank()
  db.prepare('INSERT INTO schreib_tag (tag, zeilen) VALUES (?, ?)').run(utcTag(new Date()), DECKEL_ZEILEN)
  const z = { geschrieben: 0 }
  const env = umgebung(db, z)
  const r = await handlePruefung(post(folge(1)), env)
  const kopf = Number(r.headers.get('Retry-After'))
  const inhalt = (await r.json()) as { tageslimit?: boolean }
  pruefe(r.status === 429, 'am Deckel: 429')
  pruefe(kopf > 0 && kopf <= 86400, `Retry-After bis Mitternacht UTC (${kopf} s)`)
  pruefe(inhalt.tageslimit === true, 'die Antwort sagt tageslimit: true (die Erweiterung erkennt daran die Pause)')
  pruefe(z.geschrieben === 0 && zahl(db, 'SELECT COUNT(*) AS n FROM pruefung') === 0, 'am Deckel wird nichts geschrieben')
  const stapel = await handlePruefung(post({ stapel: [folge(1), folge(2)] }), env)
  pruefe(stapel.status === 429, 'auch ein Stapel bekommt 429')
  const abhaken = await handlePruefung(post({ uebernommen: [1] }), env)
  pruefe(abhaken.status === 200, 'Aufträge der Pipeline (abhaken) bleiben am Deckel frei')
}
{
  const db = neueDatenbank()
  db.exec('DROP TABLE schreib_tag')
  const r = await handlePruefung(post(folge(1)), umgebung(db))
  pruefe(r.status === 200, 'ein Fehler beim Zählen sperrt nicht (Zähltabelle fehlt)')
}
{
  const quellen = readdirSync('worker/src')
    .filter((f) => f.endsWith('.ts'))
    .filter((f) => readFileSync(`worker/src/${f}`, 'utf8').includes("from './tagesdeckel.ts'"))
  pruefe(quellen.join() === 'pruefung-speichern.ts', `nur die Meldungs-Route nutzt den Deckel (${quellen.join(', ')}) — Anmeldung, Push, Cron bleiben frei`)
}

console.log('Unveränderte Meldung')
{
  const db = neueDatenbank()
  const z = { geschrieben: 0 }
  const env = umgebung(db, z)
  await handlePruefung(post(folge(1)), env)
  const erst = z.geschrieben
  const r = await handlePruefung(post(folge(1)), env)
  const inhalt = (await r.json()) as { unveraendert?: boolean }
  pruefe(erst > 0 && z.geschrieben === erst, `Wiederholung schreibt keine Zeile mehr (${erst} Zeilen beim Erstmal)`)
  pruefe(inhalt.unveraendert === true, 'die Antwort sagt unveraendert, der Befund bleibt ok')
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM pruefung') === 1 && zahl(db, 'SELECT COUNT(*) AS n FROM prime_folge') === 1, 'keine Dublette')
  await handlePruefung(post(folge(1, 'nein')), env)
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM pruefung') === 1 && zahl(db, "SELECT COUNT(*) AS n FROM pruefung WHERE ton_de = 'nein'") === 1, 'geänderte Meldung ersetzt die alte')
  const stapel = await handlePruefung(post({ stapel: [folge(1, 'nein'), folge(2)] }), env)
  const ergebnisse = ((await stapel.json()) as { ergebnisse: { ok: boolean }[] }).ergebnisse
  pruefe(ergebnisse.every((e) => e.ok) && zahl(db, 'SELECT COUNT(*) AS n FROM pruefung') === 2, 'Stapel: Unverändertes übersprungen, Neues gespeichert')
  db.exec("UPDATE pruefung SET uebernommen = 1")
  await handlePruefung(post(folge(2)), env)
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM pruefung WHERE uebernommen = 0') === 1, 'nach dem Abhaken entsteht einmal eine neue offene Zeile')
}

console.log('Unveränderte Meldung und Listenbau (Bleach-Fall, pruefung-stand.ts)')
{
  const db = neueDatenbank()
  const z = { geschrieben: 0 }
  const env = umgebung(db, z)
  const ZIEL = 'https://www.disneyplus.com/de-de/browse/entity-x'
  await handlePruefung(post(folge(1)), env)
  /* Die Meldung ist älter als der Listenbau; das Ziel ist eine Wiedervorlage und verlangt eine neuere. */
  db.exec("UPDATE pruefung SET gemeldet_am = '2020-01-01T00:00:00Z'")
  stand.anbieter = [{ name: 'Disney+', plattform: 'disneyplus', offen: 1, gesamt: 1, gemeldet: 0, ziele: [{ url: ZIEL, titel: 'Testtitel', seit: '2019-12-01' }] }]
  const rechne = async () => {
    const antwort = await berechnePruefstand({ env, antwort: (body) => Response.json(body) })
    return ((await antwort.json()) as { anbieter: { ziele: { url: string }[] }[] }).anbieter[0]!.ziele.length
  }
  pruefe((await rechne()) === 1, 'vorher: das Ziel ist offen (die alte Meldung zählt nicht)')
  const vorher = z.geschrieben
  const r = await handlePruefung(post(folge(1)), env)
  pruefe(((await r.json()) as { unveraendert?: boolean }).unveraendert === true, 'dieselbe Meldung wird als unverändert erkannt')
  pruefe(z.geschrieben - vorher === 2, `... und erneuert nur gemeldet_am (Zeile + Tageszähler, gemessen ${z.geschrieben - vorher})`)
  pruefe((await rechne()) === 0, 'danach zählt das Ziel als erledigt (kein ewiges Neumelden)')
  const nachErneuerung = z.geschrieben
  await handlePruefung(post(folge(1)), env)
  pruefe(z.geschrieben === nachErneuerung, 'die zweite gleiche Meldung schreibt 0 Zeilen')
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM pruefung') === 1 && zahl(db, 'SELECT COUNT(*) AS n FROM prime_folge') === 1, 'weiter keine Dublette')
}

console.log('Lesezeilen: Pläne der Abfragen einer Meldung (EXPLAIN QUERY PLAN, 11.10.2026)')
const planVon = (db: DatabaseSync, a: { sql: string; werte: unknown[] }) =>
  (db.prepare(`EXPLAIN QUERY PLAN ${a.sql}`).all(...(a.werte as never[])) as { detail: string }[]).map((z) => z.detail).join(' ; ')
{
  const db = neueDatenbank()
  const env = umgebung(db)
  abfragen.length = 0
  const adresse = (n: number) => ({ ...folge(1), url: `https://www.disneyplus.com/de-de/browse/entity-${n}` })
  await handlePruefung(post({ stapel: [adresse(1), adresse(2), adresse(3)] }), env)
  const hashAbfrage = abfragen.find((a) => /FROM pruefung\b.*WHERE uebernommen = 0 AND url IN/s.test(a.sql))
  const plan = hashAbfrage ? planVon(db, hashAbfrage) : ''
  pruefe(hashAbfrage?.werte.length === 3, 'der Stapel mit drei Adressen lädt die offenen Zeilen mit einer Abfrage')
  pruefe(plan.includes('pruefung_url_zeit') && !plan.includes('idx_pruefung_offen'), `die Hash-Abfrage nimmt bei drei Adressen den Adress-Index (${plan})`)
}

console.log('Lesezeilen: Ersetzen über die Zeilen-ID')
{
  const db = neueDatenbank()
  const env = umgebung(db)
  abfragen.length = 0
  await handlePruefung(post({ stapel: [folge(1), folge(2)] }), env)
  pruefe(!abfragen.some((a) => /^DELETE FROM pruefung/.test(a.sql)), 'neue Folgen: kein DELETE (es gibt nichts zu ersetzen)')
  db.exec('INSERT INTO pruefung (plattform, url, befund, folge_nr, staffel, gemeldet_am) SELECT plattform, url, befund, folge_nr, staffel, gemeldet_am FROM pruefung WHERE folge_nr = 1')
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM pruefung WHERE folge_nr = 1') === 2, 'Vorbereitung: Folge 1 steht doppelt (Dublette)')
  abfragen.length = 0
  await handlePruefung(post(folge(1, 'nein')), env)
  const loeschen = abfragen.filter((a) => /^DELETE FROM pruefung/.test(a.sql))
  pruefe(loeschen.length === 1 && /WHERE id IN \(\?,\?\)$/.test(loeschen[0]!.sql), `Änderung: ein DELETE über die IDs beider Dubletten (${loeschen[0]?.sql})`)
  pruefe(!!loeschen[0] && planVon(db, loeschen[0]).includes('INTEGER PRIMARY KEY'), 'der Plan geht über den Primärschlüssel, liest keine Adresszeilen')
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM pruefung WHERE folge_nr = 1') === 1 && zahl(db, "SELECT COUNT(*) AS n FROM pruefung WHERE folge_nr = 1 AND ton_de = 'nein'") === 1, 'Folge 1: nur noch die neue Zeile')
  pruefe(zahl(db, 'SELECT COUNT(*) AS n FROM pruefung WHERE folge_nr = 2') === 1, 'Folge 2 derselben Adresse bleibt unberührt')
  pruefe(!abfragen.some((a) => /DELETE FROM pruefung WHERE url/.test(a.sql)), 'kein DELETE mehr über die Adresse')
}

if (fehler) {
  console.log(`${fehler} Prüfung(en) fehlgeschlagen.`)
  process.exit(1)
}
console.log('Alles in Ordnung.')
process.exit(0)
