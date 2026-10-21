/**
 * **Das Abhaken des Bestandsbaus in Produktionsgröße** (16.10.2026).
 *
 * Lehre: Jeder Bestandsbau schickte rund 2.900 Ids an `rohfolgenUebernommen` und bekam HTTP 500 („too many SQL
 * variables“: ein `?` je Titelnummer, D1 bindet höchstens 100). Vorher liefen schon gut 40 `UPDATE` auf `prime_folge`
 * durch, ohne `uebernommen = 0`; weil der Fehler die Marke des Auszugs `offen-*` übersprang, lieferte der nächste Bau
 * dieselben Ids, und jeder Bau schrieb dieselben rund 2.000 Zeilen erneut (1.053 solche `UPDATE` am 16.10.2026, 52.650
 * Schreibzeilen). Die Tests mit drei Ids sahen keine der drei Grenzen. Deshalb hier: ≥ 2.900 Ids, mehr als 100
 * Titelzeilen, eine Attrappe mit den Grenzen der freien Stufe (100 Bindungen je Anweisung, 50 Abfragen je Aufruf, ein
 * `batch` zählt als eine), und die Wiederholung muss schreibfrei sein.
 *
 * Aufruf: `npx tsx tools/worker-abhaken.test.ts`
 */
import { DatabaseSync } from 'node:sqlite'
import { handlePruefung } from '../worker/src/pruefung.ts'
import { PRUEFUNG_ID_AB } from '../worker/src/rohfolgen-seiten.ts'
import { eintragsId, type Eintrag } from '../worker/src/titelzeile-format.ts'
import { lies, neueDatenbank, post, zahl } from './worker-titelzeile-hilfe.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
console.error = () => {}
console.warn = () => {}
globalThis.fetch = (async () => new Response(JSON.stringify({ erzeugtAm: '2020-01-02T00:00:00.000Z', anbieter: [] }))) as typeof fetch

/**
 * Zähler eines Aufrufs; `scheitere` lässt Anweisungen mit diesem Anfang scheitern (Teilerfolg), `dazwischen` läuft
 * vor dem Stapel der Titelzeilen (eine fremde Änderung zwischen Lesen und Schreiben).
 */
const z = { abfragen: 0, geschrieben: 0, scheitere: '', dazwischen: null as null | (() => void) }
type Anweisung = { sql: string; werte: unknown[]; bind: (...w: unknown[]) => Anweisung; run: () => Promise<unknown>; all: () => Promise<unknown>; first: () => Promise<unknown> }

/** Eine D1-Attrappe mit den Grenzen der freien Stufe, wie die echte D1 sie mit einer Ausnahme beantwortet. */
function d1(db: DatabaseSync) {
  const zaehle = () => {
    if (++z.abfragen > 50) throw new Error('Too many API requests by single worker invocation')
  }
  const fuehreAus = (a: Anweisung) => {
    if (a.werte.length > 100) throw new Error('D1_ERROR: too many SQL variables')
    if (z.scheitere && a.sql.startsWith(z.scheitere)) throw new Error('D1_ERROR: Attrappe scheitert')
    const r = db.prepare(a.sql).run(...(a.werte as never[]))
    z.geschrieben += Number(r.changes)
    return { meta: { changes: Number(r.changes), rows_written: Number(r.changes), rows_read: 0 } }
  }
  const anweisung = (sql: string, werte: unknown[] = []): Anweisung => {
    const a: Anweisung = {
      sql,
      werte,
      bind: (...w) => anweisung(sql, w),
      run: async () => (zaehle(), fuehreAus(a)),
      all: async () => {
        zaehle()
        if (werte.length > 100) throw new Error('D1_ERROR: too many SQL variables')
        return { results: db.prepare(sql).all(...(werte as never[])), meta: { rows_written: 0, rows_read: 0 } }
      },
      first: async () => (zaehle(), db.prepare(sql).get(...(werte as never[])) ?? null),
    }
    return a
  }
  return {
    prepare: (sql: string) => anweisung(sql),
    batch: async (liste: Anweisung[]) => {
      zaehle()
      if (liste[0]?.sql.startsWith('UPDATE titel_zeile')) z.dazwischen?.()
      db.exec('BEGIN')
      try {
        const antworten = liste.map(fuehreAus)
        db.exec('COMMIT')
        return antworten
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
    },
  }
}

/** R2-Attrappe: merkt sich, welche Schlüssel geschrieben wurden (die Marke `export/_ungueltig-offen`). */
const puts: string[] = []
const belege = {
  get: async () => null,
  head: async () => null,
  put: async (k: string) => void puts.push(k),
}

const PRIME = 2_100
const ROH = 300
const TITEL = 200
const AM = '2026-10-16T10:00:00.000Z'

function befuelle(db: DatabaseSync): number[] {
  const ids: number[] = []
  const prime = db.prepare("INSERT INTO prime_folge (id, url, plattform, gti, nummer, gemeldet_am, uebernommen) VALUES (?, ?, 'amazon', ?, ?, ?, 0)")
  for (let i = 1; i <= PRIME; i++) prime.run(i, `https://www.amazon.de/gp/video/detail/A${i % 300}`, `g${i}`, i, AM)
  const roh = db.prepare("INSERT INTO pruefung (id, plattform, url, befund, gemeldet_am, rohfolge, roh_uebernommen, folge_nr) VALUES (?, 'netflix', ?, 'dub', ?, '{}', 0, ?)")
  for (let i = 1; i <= ROH; i++) roh.run(i, `https://www.netflix.com/title/${i}`, AM, i)
  const titel = db.prepare("INSERT INTO titel_zeile (url, plattform, nr, daten, gemeldet_am, offen_meldung, offen_rohfolge) VALUES (?, 'netflix', ?, ?, ?, 3, 3)")
  const titelIds: number[] = []
  for (let nr = 1; nr <= TITEL; nr++) {
    const f = [1, 2, 3].map((n) => [1, n, `F${n}`, `t${nr}-${n}`, ['de'], 'ja', 'ja', 'gemessen', null, AM, 0, 0, null, 0] as Eintrag)
    for (const e of f) titelIds.push(eintragsId(nr, e)!)
    titel.run(`https://www.netflix.com/title/9${nr}`, nr, JSON.stringify({ s: null, t: 'T', st: null, f }), AM)
  }
  /* Die Reihenfolge des Baus: zuerst Titelzeilen (Cartoons), Prime nicht vorn. */
  ids.push(...titelIds.slice(0, 300))
  for (let i = 1; i <= PRIME; i++) ids.push(i)
  for (let i = 1; i <= ROH; i++) ids.push(PRUEFUNG_ID_AB + i)
  ids.push(...titelIds.slice(300))
  return ids
}

const offen = (db: DatabaseSync) =>
  [
    zahl(db, 'SELECT COUNT(*) AS n FROM prime_folge WHERE uebernommen = 0'),
    zahl(db, 'SELECT COUNT(*) AS n FROM pruefung WHERE roh_uebernommen = 0'),
    zahl(db, 'SELECT IFNULL(SUM(offen_rohfolge), 0) AS n FROM titel_zeile'),
  ].join('/')

/* Die Marke wird je Isolate höchstens einmal je Minute geschrieben (`export-speicher.ts`): jeder Aufruf zwei Minuten später. */
let uhr = Date.parse('2026-10-16T18:00:00Z')
Date.now = () => uhr

async function aufruf(env: never, body: unknown) {
  uhr += 2 * 60_000
  z.abfragen = 0
  z.geschrieben = 0
  puts.length = 0
  return await handlePruefung(post(body), env)
}

console.log('Abhaken in Produktionsgröße: ein Aufruf, unter den Grenzen, Wiederholung schreibfrei')
{
  const db = neueDatenbank()
  const ids = befuelle(db)
  const env = { LAUF_TOKEN: 't', SITE_URL: 'https://attrappe.test/', DB: d1(db), BELEGE: belege } as never
  pruefe(ids.length >= 2_900, `${ids.length} Ids, davon ${TITEL * 3} in ${TITEL} Titelzeilen`)
  const r1 = await aufruf(env, { rohfolgenUebernommen: ids })
  pruefe(r1.status === 200, `erster Aufruf antwortet 200 (${r1.status})`)
  pruefe(z.abfragen <= 50, `erster Aufruf braucht ${z.abfragen} Abfragen (Grenze 50)`)
  pruefe(offen(db) === '0/0/0', `danach ist nichts mehr offen (${offen(db)})`)
  pruefe(z.geschrieben === PRIME + ROH + TITEL, `geschrieben ${z.geschrieben} = je Zeile einmal (${PRIME + ROH + TITEL})`)
  pruefe(puts.includes('export/_ungueltig-offen'), 'der Auszug der offenen Zeilen wird ungültig')

  const r2 = await aufruf(env, { rohfolgenUebernommen: ids })
  pruefe(r2.status === 200, `Wiederholung mit denselben Ids antwortet 200 (${r2.status})`)
  pruefe(z.geschrieben === 0, `Wiederholung schreibt keine Zeile (${z.geschrieben})`)

  /* Meldungen (`fetch-pruefungen.ts`): so viele, dass eine Abfrage je 50 Ids über die Grenze käme. */
  const MELDUNGEN = 2_600
  const meldung = db.prepare("INSERT INTO pruefung (id, plattform, url, befund, gemeldet_am, folge_nr) VALUES (?, 'netflix', ?, 'dub', ?, ?)")
  for (let i = ROH + 1; i <= MELDUNGEN; i++) meldung.run(i, `https://www.netflix.com/title/${i}`, AM, i)
  const meldungen = Array.from({ length: MELDUNGEN }, (_, i) => i + 1)
  db.exec('UPDATE pruefung SET uebernommen = 0')
  const r3 = await aufruf(env, { uebernommen: meldungen })
  const geschrieben3 = z.geschrieben
  const r4 = await aufruf(env, { uebernommen: meldungen })
  pruefe(r3.status === 200 && r4.status === 200, 'Meldungen abhaken (`uebernommen`) antwortet 200')
  pruefe(geschrieben3 === MELDUNGEN && z.geschrieben === 0, `Meldungen: erst ${geschrieben3}, Wiederholung ${z.geschrieben} Zeilen`)
}

console.log('Teilerfolg: Die Marke des Auszugs steht auch nach einem Fehler, eine Ablehnung setzt keine')
{
  const db = neueDatenbank()
  const ids = befuelle(db)
  const env = { LAUF_TOKEN: 't', SITE_URL: 'https://attrappe.test/', DB: d1(db), BELEGE: belege } as never
  z.scheitere = 'UPDATE titel_zeile'
  const r = await aufruf(env, { rohfolgenUebernommen: ids })
  z.scheitere = ''
  pruefe(r.status === 500, `scheitert der Titelteil, antwortet die Route 500 (${r.status})`)
  pruefe(offen(db) === `0/0/${TITEL * 3}`, `Prime und Meldungsspalte sind trotzdem abgehakt (${offen(db)})`)
  pruefe(puts.includes('export/_ungueltig-offen'), 'die Marke steht, der nächste Bau liest einen frischen Auszug')

  const abgelehnt = await aufruf(env, { reoeffnen: { plattform: 'netflix' } })
  pruefe(abgelehnt.status === 400 && !puts.includes('export/_ungueltig-offen'), 'eine abgelehnte Anfrage (400) setzt keine Marke')
}

console.log('Versionskonflikt: Ein Titel, der zwischen Lesen und Schreiben geändert wird, bleibt unverändert und offen')
{
  const db = neueDatenbank()
  const ids = befuelle(db)
  const env = { LAUF_TOKEN: 't', SITE_URL: 'https://attrappe.test/', DB: d1(db), BELEGE: belege } as never
  /* Mitten in der Liste, nicht der erste Titel: die anderen 199 werden trotzdem abgehakt. */
  const fremd = "UPDATE titel_zeile SET version = version + 1, daten = json_set(daten, '$.t', 'Fremd') WHERE nr = 100"
  z.dazwischen = () => db.exec(fremd)
  const r = await aufruf(env, { rohfolgenUebernommen: ids })
  z.dazwischen = null
  const t100 = db.prepare('SELECT daten, offen_rohfolge AS o FROM titel_zeile WHERE nr = 100').get() as { daten: string; o: number }
  pruefe(r.status === 200, `ein Konflikt ist kein Fehler (${r.status})`)
  pruefe(offen(db) === '0/0/3', `nur die drei Folgen des geänderten Titels bleiben offen (${offen(db)})`)
  pruefe(JSON.parse(t100.daten).t === 'Fremd' && t100.o === 3, 'die fremde Änderung bleibt erhalten, nichts überschrieben')
  await aufruf(env, { rohfolgenUebernommen: ids })
  pruefe(offen(db) === '0/0/0' && z.geschrieben === 1, `der nächste Bau hakt ihn ab (${offen(db)}, ${z.geschrieben} Zeile)`)
}

console.log('Fenster der offenen Meldungen: die ältesten 5000 aus beiden Quellen (vorher 500, 12.–16.10.2026 verstopft)')
{
  const db = neueDatenbank()
  const env = { LAUF_TOKEN: 't', SITE_URL: 'https://attrappe.test/', DB: d1(db), BELEGE: belege } as never
  const zeit = (s: number) => new Date(Date.parse('2026-10-01T00:00:00Z') + s * 1000).toISOString()
  /* Jede Quelle über dem Fenster (sonst überlebt `DESC`) und verzahnt: Altzeilen zu geraden, Folgen der Titelzeile zu ungeraden Sekunden. */
  const alt = db.prepare("INSERT INTO pruefung (id, plattform, url, befund, gemeldet_am, folge_nr) VALUES (?, 'netflix', ?, 'dub', ?, 1)")
  for (let i = 1; i <= 5_002; i++) alt.run(900_000 + i, `https://www.netflix.com/title/8${i}`, zeit(2 * i))
  const f = Array.from({ length: 5_001 }, (_, i) => [1, i + 1, `F${i + 1}`, `g${i}`, ['de'], 'ja', 'ja', 'gemessen', null, zeit(2 * i + 3), 0, 1, null, 0] as Eintrag)
  const titelzeile = "INSERT INTO titel_zeile (url, plattform, nr, daten, gemeldet_am, offen_meldung, offen_rohfolge) VALUES ('https://www.netflix.com/title/7', 'netflix', 1, ?, ?, 5001, 0)"
  db.prepare(titelzeile).run(JSON.stringify({ s: null, t: 'T', st: null, f }), zeit(10_003))
  z.abfragen = 0
  const offenListe = (await lies(env, '')).pruefungen as { id: number; gemeldet_am: string }[]
  const am = offenListe.map((p) => p.gemeldet_am)
  pruefe(offenListe.length === 5_000, `10.003 offen, geliefert ${offenListe.length}`)
  pruefe(am.every((t, i) => i === 0 || am[i - 1]! < t) && am[0] === zeit(2), 'die ältesten zuerst, aufsteigend')
  pruefe(am.at(-1) === zeit(5_001), `die jüngeren 5.003 fallen weg, aus beiden Quellen (${am.at(-1)})`)
}

if (fehler) {
  console.log(`\n${fehler} Fehler`)
  process.exit(1)
}
console.log('\nAlles in Ordnung')
